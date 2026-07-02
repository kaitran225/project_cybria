/** Parse ANSI SGR sequences and render a terminal line into a parent element. */
const SGR_RE = /\x1b\[([0-9;]*)m/g;

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

function semanticClass(line: string): string {
	if (line.startsWith("$ ")) return "tlog-cmd";
	if (line.startsWith("[download]")) {
		return /error/i.test(line) ? "tlog-err" : "tlog-ok";
	}
	if (line.startsWith("[exit ")) {
		return line.startsWith("[exit 0]") ? "tlog-ok" : "tlog-err";
	}
	if (/UserWarning|warning:/i.test(line)) return "tlog-warn";
	if (/error|failed|traceback|exception/i.test(line)) return "tlog-err";
	if (line.startsWith("[cybria-server]") || line.startsWith("[switcher]")) return "tlog-info";
	if (/\b(ready|running|saved|complete|ok)\b/i.test(line)) return "tlog-ok";
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

export function renderTerminalLine(parent: HTMLElement, line: string): void {
	const row = parent.createDiv({ cls: "ccore-terminal-line" });
	const semantic = semanticClass(line);
	if (semantic) row.addClass(semantic);

	if (!line.includes("\x1b[")) {
		row.setText(line);
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
