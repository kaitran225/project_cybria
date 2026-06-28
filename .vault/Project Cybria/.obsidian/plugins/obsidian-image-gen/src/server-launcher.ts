import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { existsSync } from "fs";
import * as path from "path";

export interface ReqCheckResult {
	ok: boolean;
	python?: string;
	executable?: string;
	model?: string;
	max_side?: number;
	packages: Record<string, string>;
	errors: string[];
}

function splitLines(text: string, onLine: (line: string) => void): void {
	for (const line of text.split(/\r?\n/)) {
		if (line.length > 0) onLine(line);
	}
}

export class ImageServerRunner {
	private proc: ChildProcessWithoutNullStreams | null = null;

	resolveToolsDir(vaultBasePath: string, override = ""): string {
		if (override.trim()) return override.trim();
		const repoRoot = path.dirname(path.dirname(vaultBasePath));
		return path.join(repoRoot, ".tools", "qwen-image");
	}

	pythonExe(toolsDir: string): string {
		return path.join(toolsDir, ".venv", "Scripts", "python.exe");
	}

	pipExe(toolsDir: string): string {
		return path.join(toolsDir, ".venv", "Scripts", "pip.exe");
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
		onLine: (line: string) => void
	): Promise<number> {
		onLine(`$ ${cmd} ${args.join(" ")}`);
		return new Promise((resolve, reject) => {
			const proc = spawn(cmd, args, { cwd, windowsHide: true });
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
			const code = await this.runCommand(
				"py",
				["-3.12", "-m", "venv", ".venv"],
				toolsDir,
				onLine
			);
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
				env: { ...process.env, QWEN_IMAGE_MAX_SIDE: "768" },
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
					const parsed = JSON.parse(line) as ReqCheckResult;
					resolve(parsed);
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

	async installRequirements(
		toolsDir: string,
		onLine: (line: string) => void
	): Promise<void> {
		await this.ensureVenv(toolsDir, onLine);
		const pip = this.pipExe(toolsDir);
		const code = await this.runCommand(
			pip,
			["install", "-r", "requirements.txt"],
			toolsDir,
			onLine
		);
		if (code !== 0) throw new Error(`pip install failed (exit ${code})`);
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
			env: {
				...process.env,
				QWEN_IMAGE_MAX_SIDE: "768",
				PYTHONUNBUFFERED: "1",
			},
		}) as ChildProcessWithoutNullStreams;
		this.proc = proc;
		this.attachStreams(proc, onLine);
	}

	stopServer(onLine: (line: string) => void): void {
		if (!this.proc) {
			onLine("$ no server process attached");
			return;
		}
		onLine("$ taskkill /PID …");
		this.proc.kill();
		this.proc = null;
	}
}
