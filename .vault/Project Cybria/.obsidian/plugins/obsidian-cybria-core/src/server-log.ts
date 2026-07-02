import { shouldSkipTerminalLine } from "./terminal-ansi";

export type LogListener = (line: string) => void;

/** Shared terminal buffer for all Cybria Python servers. */
export class ServerLog {
	private lines: string[] = [];
	private listeners = new Set<LogListener>();
	private maxLines: number;

	constructor(maxLines = 5000) {
		this.maxLines = maxLines;
	}

	append(line: string): void {
		if (shouldSkipTerminalLine(line)) return;
		this.lines.push(line);
		if (this.lines.length > this.maxLines) this.lines.shift();
		console.log(`[cybria] ${line}`);
		for (const fn of this.listeners) fn(line);
	}

	onLine(fn: LogListener): () => void {
		this.listeners.add(fn);
		return () => this.listeners.delete(fn);
	}

	getLines(): string[] {
		return [...this.lines];
	}

	clear(): void {
		this.lines = [];
	}

	writer(prefix = ""): (line: string) => void {
		return (line: string) => this.append(prefix ? `${prefix}${line}` : line);
	}
}
