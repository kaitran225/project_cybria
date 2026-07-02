/** Parse ANSI SGR sequences and render a terminal line into a parent element. */
const SGR_RE = /\x1b\[([0-9;]*)m/g;
const SVC_TAG_RE = /^\[([a-z][\w-]*)\]\s*/i;
const PROGRESS_RE = /^(Loading|Fetching|\s*\d+%|\s*\|)/i;

const SGR_CLASS: Record<number, string> = {
	1: "ansi-bold",
	30: "ansi-fg-black",
	31: "ansi-fg-red",
	32: "ansi-fg-green",
	33: "ansi-fg-yellow",
	34: "ansi-fg-blue",
	35: "ansi-fg-magenta",
	36: "ansi-fg-cyan",
	37: "ansi-fg-white",
	90: "ansi-fg-bright-black",
	91: "ansi-fg-bright-red",
	92: "ansi-fg-bright-green",
	93: "ansi-fg-bright-yellow",
	94: "ansi-fg-bright-blue",
	95: "ansi-fg-bright-magenta",
	96: "ansi-fg-bright-cyan",
	97: "ansi-fg-bright-white",
};

const SERVICE_COLORS: Record<string, string> = {
	gateway: "tlog-tag-gateway",
	"cybria-server": "tlog-tag-gateway",
	llm: "tlog-tag-llm",
	summarize: "tlog-tag-summarize",
	tts: "tlog-tag-tts",
	image: "tlog-tag-image",
	start: "tlog-tag-action",
	switcher: "tlog-tag-action",
};

type LineKind = "cmd" | "meta" | "info" | "ok" | "warn" | "err" | "stderr-info" | "progress" | "comment" | "";

function stripAnsi(text: string): string {
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function classifyLine(raw: string, isStderr: boolean): LineKind {
	const line = stripAnsi(raw);
	if (line.startsWith("# ")) return "comment";
	if (line.startsWith("$ ")) return "cmd";
	if (line.startsWith("  cwd:") || line.startsWith("  pid:")) return "meta";
	if (line.startsWith("[exit ")) return line.startsWith("[exit 0]") ? "ok" : "err";
	if (line.startsWith("[download]")) return /error/i.test(line) ? "err" : "ok";
	if (/\[generate\]/.test(line)) return "info";
	if (PROGRESS_RE.test(line) || line.includes("[A") || line.includes("it/s]")) return "progress";
	if (isStderr) {
		if (/^INFO:/i.test(line)) return "stderr-info";
		if (/^WARNING:|UserWarning|FutureWarning|DeprecationWarning/i.test(line)) return "warn";
		if (/^ERROR:|Traceback|Exception|FileNotFoundError/i.test(line)) return "err";
		return "stderr-info";
	}
	if (line.startsWith("[cybria-server]") || line.startsWith("[switcher]") || line.startsWith("[start]"))
		return "info";
	if (/error|failed|traceback|exception/i.test(line)) return "err";
	if (/UserWarning|warning:/i.test(line)) return "warn";
	if (/\b(ready|running|saved|complete|Successfully installed)\b/i.test(line)) return "ok";
	return "";
}

function applySgr(classes: Set<string>, code: number): void {
	if (code === 0) {
		classes.clear();
		return;
	}
	const cls = SGR_CLASS[code];
	if (cls) classes.add(cls);
}

function appendSpan(parent: HTMLElement, text: string, classes: Set<string>): void {
	if (!text) return;
	const span = parent.createSpan({ text });
	for (const cls of classes) span.addClass(cls);
}

function appendBody(row: HTMLElement, line: string): void {
	if (!line.includes("\x1b[")) {
		row.createSpan({ text: line, cls: "tlog-body" });
		return;
	}
	const classes = new Set<string>();
	let last = 0;
	let match: RegExpExecArray | null;
	SGR_RE.lastIndex = 0;
	while ((match = SGR_RE.exec(line)) !== null) {
		appendSpan(row, line.slice(last, match.index), classes);
		const parts = match[1].split(";").filter(Boolean);
		if (parts.length === 0) applySgr(classes, 0);
		for (const part of parts) applySgr(classes, parseInt(part, 10));
		last = match.index + match[0].length;
	}
	appendSpan(row, line.slice(last), classes);
}

const ACCESS_LOG_RE = /^INFO:\s+[\d.:]+\s+-\s+"(?:GET|POST|PUT|DELETE|PATCH|OPTIONS)\s+/i;

/** Drop uvicorn per-request access lines, especially /health polling. */
export function shouldSkipTerminalLine(line: string): boolean {
	let body = line.startsWith("⟨err⟩ ") ? line.slice(6) : line;
	body = body.replace(/^\[[\w-]+\]\s*/, "");
	if (ACCESS_LOG_RE.test(body)) return true;
	if (/\/health\b/i.test(body) && /\b(?:GET|POST)\b/i.test(body)) return true;
	return false;
}

export function renderTerminalLine(parent: HTMLElement, line: string): void {
	let isStderr = false;
	if (line.startsWith("⟨err⟩ ")) {
		isStderr = true;
		line = line.slice(6);
	}

	const kind = classifyLine(line, isStderr);
	const row = parent.createDiv({ cls: "ccore-terminal-line" });
	if (kind) row.addClass(`tlog-${kind}`);

	let body = line;
	const svcMatch = body.match(SVC_TAG_RE);
	if (svcMatch) {
		const svc = svcMatch[1].toLowerCase();
		const tagKey = svc === "cybria-server" ? "gateway" : svc;
		const tag = row.createSpan({ cls: "tlog-tag", text: tagKey });
		tag.addClass(SERVICE_COLORS[tagKey] ?? SERVICE_COLORS[svc] ?? "tlog-tag-default");
		body = body.slice(svcMatch[0].length);
	}

	appendBody(row, body);
}
