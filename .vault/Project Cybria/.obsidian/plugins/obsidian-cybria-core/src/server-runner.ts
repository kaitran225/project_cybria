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

function splitLines(text: string, onLine: (line: string) => void): void {
	for (const line of text.split(/\r?\n/)) {
		if (line.length > 0) onLine(line);
	}
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
		return { ...process.env, ...modelPathEnv(paths), ...extra };
	}

	isRunning(): boolean {
		return this.proc !== null;
	}

	private attachStreams(
		proc: ChildProcessWithoutNullStreams,
		onLine: (line: string) => void
	): void {
		proc.stdout.on("data", (chunk: Buffer) => splitLines(chunk.toString(), onLine));
		proc.stderr.on("data", (chunk: Buffer) => splitLines(chunk.toString(), onLine));
		proc.on("close", (code) => {
			onLine(`[exit ${code ?? "?"}]`);
			if (this.proc === proc) this.proc = null;
		});
	}

	runCommand(
		cmd: string,
		args: string[],
		cwd: string,
		onLine: (line: string) => void,
		env?: NodeJS.ProcessEnv
	): Promise<number> {
		onLine(`$ ${cmd} ${args.join(" ")}`);
		return new Promise((resolve, reject) => {
			const proc = spawn(cmd, args, { cwd, windowsHide: true, env });
			proc.stdout?.on("data", (c: Buffer) => splitLines(c.toString(), onLine));
			proc.stderr?.on("data", (c: Buffer) => splitLines(c.toString(), onLine));
			proc.on("error", reject);
			proc.on("close", (code) => resolve(code ?? 1));
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
		onLine(`$ ${py} check_env.py`);
		return new Promise((resolve, reject) => {
			const proc = spawn(py, ["check_env.py"], {
				cwd: toolsDir,
				windowsHide: true,
				env: this.serverEnv(toolsDir),
			});
			let stdout = "";
			proc.stdout?.on("data", (c: Buffer) => {
				const t = c.toString();
				splitLines(t, onLine);
				stdout += t;
			});
			proc.stderr?.on("data", (c: Buffer) => splitLines(c.toString(), onLine));
			proc.on("error", reject);
			proc.on("close", (code) => {
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
			["download.py", modelId],
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
		onLine(`$ ${py} server.py`);
		const proc = spawn(py, ["server.py"], {
			cwd: toolsDir,
			windowsHide: true,
			env: this.serverEnv(toolsDir),
		}) as ChildProcessWithoutNullStreams;
		this.proc = proc;
		this.attachStreams(proc, onLine);
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

/** qwen-image needs extra env vars at launch. */
export const QWEN_IMAGE_ENV: ServerEnvExtra = () => ({
	QWEN_IMAGE_MAX_SIDE: "512",
	QWEN_IMAGE_LIGHTNING: "1",
	QWEN_IMAGE_COMPILE: "0",
});
