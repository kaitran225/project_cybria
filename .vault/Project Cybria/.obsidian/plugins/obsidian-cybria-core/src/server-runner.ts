import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { existsSync, mkdirSync } from "fs";
import * as path from "path";
import {
	hubCacheDir,
	loadModelPathsFromTools,
	modelPathEnv,
	type ModelPathsConfig,
} from "./model-paths";

export interface ReqCheckResult {
	ok: boolean;
	python?: string;
	executable?: string;
	model?: string;
	max_side?: number;
	packages: Record<string, string>;
	errors: string[];
}

export type ServerEnvExtra = (paths: ModelPathsConfig) => Record<string, string>;

/**
 * Stateful line splitter: buffers partial lines that arrive split across
 * stdout/stderr chunks, so nothing is ever dropped or fragmented.
 */
class LineBuffer {
	private buf = "";

	constructor(private readonly onLine: (line: string) => void) {}

	push(chunk: string): void {
		this.buf += chunk;
		let idx: number;
		while ((idx = this.buf.indexOf("\n")) >= 0) {
			const line = this.buf.slice(0, idx).replace(/\r$/, "");
			this.buf = this.buf.slice(idx + 1);
			this.onLine(line);
		}
	}

	flush(): void {
		if (this.buf.length > 0) {
			const rest = this.buf.replace(/\r$/, "");
			this.buf = "";
			if (rest.length > 0) this.onLine(rest);
		}
	}
}

/** Attach stdout+stderr of a process to a log sink, labeling stderr. */
function pipeProcess(
	proc: import("child_process").ChildProcess,
	onLine: (line: string) => void,
	label: string
): void {
	const out = new LineBuffer(onLine);
	const err = new LineBuffer((l) => onLine(`⟨err⟩ ${l}`));
	proc.stdout?.setEncoding("utf-8");
	proc.stderr?.setEncoding("utf-8");
	proc.stdout?.on("data", (c: string) => out.push(c));
	proc.stderr?.on("data", (c: string) => err.push(c));
	proc.on("error", (e) => onLine(`[${label}] spawn error: ${e.message}`));
	proc.on("close", (code, signal) => {
		out.flush();
		err.flush();
		onLine(`[${label}] exited (code ${code ?? "?"}${signal ? `, signal ${signal}` : ""})`);
	});
}

export class CybriaServerRunner {
	private proc: ChildProcessWithoutNullStreams | null = null;
	private readonly toolsSubdir: string;
	private readonly extraEnv?: ServerEnvExtra;

	constructor(toolsSubdir: string, extraEnv?: ServerEnvExtra) {
		this.toolsSubdir = toolsSubdir;
		this.extraEnv = extraEnv;
	}

	resolveToolsDir(vaultBasePath: string, override = ""): string {
		if (override.trim()) return override.trim();
		const repoRoot = path.dirname(path.dirname(vaultBasePath));
		return path.join(repoRoot, ".tools", this.toolsSubdir);
	}

	pythonExe(toolsDir: string): string {
		return path.join(toolsDir, ".venv", "Scripts", "python.exe");
	}

	pipExe(toolsDir: string): string {
		return path.join(toolsDir, ".venv", "Scripts", "pip.exe");
	}

	private ensureModelDirs(toolsDir: string): void {
		const paths = loadModelPathsFromTools(toolsDir);
		const hub = hubCacheDir(paths.huggingface);
		for (const dir of [
			paths.root,
			paths.loras,
			paths.huggingface,
			paths.llm,
			paths.tts,
			paths.summarization,
			hub,
		]) {
			if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		}
	}

	private serverEnv(toolsDir: string): NodeJS.ProcessEnv {
		this.ensureModelDirs(toolsDir);
		const paths = loadModelPathsFromTools(toolsDir);
		const extra = this.extraEnv?.(paths) ?? {};
		return { ...process.env, ...modelPathEnv(paths), ...extra, ...this.runtimeEnv() };
	}

	private runtimeEnv(): NodeJS.ProcessEnv {
		return {
			PYTHONUNBUFFERED: "1",
			PYTHONIOENCODING: "utf-8",
			FORCE_COLOR: "1",
			HF_HUB_ENABLE_HF_TRANSFER: "1",
		};
	}

	isRunning(): boolean {
		return this.proc !== null;
	}

	runCommand(
		cmd: string,
		args: string[],
		cwd: string,
		onLine: (line: string) => void,
		env?: NodeJS.ProcessEnv
	): Promise<number> {
		onLine(`$ ${cmd} ${args.join(" ")}`);
		onLine(`  cwd: ${cwd}`);
		return new Promise((resolve, reject) => {
			const proc = spawn(cmd, args, { cwd, windowsHide: true, env });
			onLine(`  pid: ${proc.pid ?? "(failed to spawn)"}`);
			const out = new LineBuffer(onLine);
			const err = new LineBuffer((l) => onLine(`⟨err⟩ ${l}`));
			proc.stdout?.setEncoding("utf-8");
			proc.stderr?.setEncoding("utf-8");
			proc.stdout?.on("data", (c: string) => out.push(c));
			proc.stderr?.on("data", (c: string) => err.push(c));
			proc.on("error", (e) => {
				onLine(`  spawn error: ${e.message}`);
				reject(e);
			});
			proc.on("close", (code, signal) => {
				out.flush();
				err.flush();
				onLine(`[exit ${code ?? "?"}${signal ? ` signal ${signal}` : ""}]`);
				resolve(code ?? 1);
			});
		});
	}

	async ensureVenv(toolsDir: string, onLine: (line: string) => void): Promise<void> {
		const venvPy = this.pythonExe(toolsDir);
		if (existsSync(venvPy)) return;
		onLine("$ py -3.12 -m venv .venv");
		const code = await this.runCommand("py", ["-3.12", "-m", "venv", ".venv"], toolsDir, onLine);
		if (code !== 0) throw new Error(`venv create failed (exit ${code})`);
	}

	async checkRequirements(
		toolsDir: string,
		onLine: (line: string) => void
	): Promise<ReqCheckResult> {
		await this.ensureVenv(toolsDir, onLine);
		const py = this.pythonExe(toolsDir);
		onLine(`$ ${py} -u check_env.py`);
		return new Promise((resolve, reject) => {
			const proc = spawn(py, ["-u", "check_env.py"], {
				cwd: toolsDir,
				windowsHide: true,
				env: this.serverEnv(toolsDir),
			});
			onLine(`  pid: ${proc.pid ?? "(failed to spawn)"}`);
			let stdout = "";
			const out = new LineBuffer((l) => {
				onLine(l);
				stdout += l + "\n";
			});
			const err = new LineBuffer((l) => onLine(`⟨err⟩ ${l}`));
			proc.stdout?.setEncoding("utf-8");
			proc.stderr?.setEncoding("utf-8");
			proc.stdout?.on("data", (c: string) => out.push(c));
			proc.stderr?.on("data", (c: string) => err.push(c));
			proc.on("error", (e) => {
				onLine(`  spawn error: ${e.message}`);
				reject(e);
			});
			proc.on("close", (code) => {
				out.flush();
				err.flush();
				try {
					const line = stdout.trim().split(/\r?\n/).pop() ?? "{}";
					resolve(JSON.parse(line) as ReqCheckResult);
				} catch (e) {
					reject(
						new Error(
							`check_env parse failed (exit ${code}): ${e instanceof Error ? e.message : e}`
						)
					);
				}
			});
		});
	}

	async installRequirements(toolsDir: string, onLine: (line: string) => void): Promise<void> {
		await this.ensureVenv(toolsDir, onLine);
		const pip = this.pipExe(toolsDir);
		const code = await this.runCommand(
			pip,
			["install", "-r", "requirements.txt"],
			toolsDir,
			onLine,
			this.serverEnv(toolsDir)
		);
		if (code !== 0) throw new Error(`pip install failed (exit ${code})`);
	}

	async downloadModel(
		toolsDir: string,
		modelId: string,
		onLine: (line: string) => void
	): Promise<void> {
		await this.ensureVenv(toolsDir, onLine);
		const py = this.pythonExe(toolsDir);
		const code = await this.runCommand(
			py,
			["-u", "download.py", modelId],
			toolsDir,
			onLine,
			this.serverEnv(toolsDir)
		);
		if (code !== 0) throw new Error(`download failed (exit ${code})`);
	}

	launchServer(toolsDir: string, onLine: (line: string) => void): void {
		if (this.proc) {
			onLine("$ server already running in this panel");
			return;
		}
		const py = this.pythonExe(toolsDir);
		if (!existsSync(py)) {
			onLine(`[gateway] python not found: ${py}`);
			onLine(`[gateway] run "Install deps" to create the venv first`);
			return;
		}
		onLine(`$ ${py} -u server.py`);
		onLine(`  cwd: ${toolsDir}`);
		const env = this.serverEnv(toolsDir);
		const proc = spawn(py, ["-u", "server.py"], {
			cwd: toolsDir,
			windowsHide: true,
			env,
		}) as ChildProcessWithoutNullStreams;
		this.proc = proc;
		onLine(`  pid: ${proc.pid ?? "(failed to spawn)"}`);
		pipeProcess(proc, onLine, "gateway");
		proc.on("close", () => {
			if (this.proc === proc) this.proc = null;
		});
	}

	stopServer(onLine: (line: string) => void): void {
		if (!this.proc) {
			onLine("$ no server process attached");
			return;
		}
		onLine("$ stopping server");
		this.proc.kill();
		this.proc = null;
	}
}

/** Env for unified gateway on port 2253. */
export const GATEWAY_ENV: ServerEnvExtra = () => ({
	CYBRIA_PORT: String(2253),
	QWEN_IMAGE_MAX_SIDE: "512",
	QWEN_IMAGE_LIGHTNING: "1",
	QWEN_IMAGE_COMPILE: "0",
});

/** @deprecated Gateway passes image env to subprocess */
export const QWEN_IMAGE_ENV: ServerEnvExtra = GATEWAY_ENV;
