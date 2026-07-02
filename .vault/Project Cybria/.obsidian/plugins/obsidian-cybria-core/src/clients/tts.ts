import { apiBase, parseError } from "../http";

export class TtsClient {
	constructor(private readonly defaultUrl: string) {}

	async ping(baseUrl = this.defaultUrl): Promise<{ ready?: boolean; error?: string }> {
		const res = await fetch(`${apiBase(baseUrl)}/health`);
		if (!res.ok) throw new Error(`TTS server not reachable (${res.status})`);
		return (await res.json()) as { ready?: boolean; error?: string };
	}

	async synthesize(text: string, baseUrl = this.defaultUrl, speed = 1.0): Promise<ArrayBuffer> {
		const res = await fetch(`${apiBase(baseUrl)}/tts`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text, speed }),
		});
		if (!res.ok) throw new Error(await parseError(res, `TTS failed (${res.status})`));
		return await res.arrayBuffer();
	}

	async downloadModel(baseUrl = this.defaultUrl): Promise<void> {
		const res = await fetch(`${apiBase(baseUrl)}/download`, { method: "POST" });
		if (!res.ok) throw new Error(await parseError(res, `Download failed (${res.status})`));
	}

	async loadModel(baseUrl = this.defaultUrl): Promise<void> {
		const res = await fetch(`${apiBase(baseUrl)}/models/load`, { method: "POST" });
		if (!res.ok) throw new Error(await parseError(res, `Load failed (${res.status})`));
	}
}
