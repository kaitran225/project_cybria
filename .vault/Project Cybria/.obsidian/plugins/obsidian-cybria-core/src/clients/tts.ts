import { apiBase, parseError } from "../http";

export class TtsClient {
	constructor(private readonly defaultUrl: string) {}

	async ping(baseUrl = this.defaultUrl): Promise<{
		ready?: boolean;
		error?: string;
		model_id?: string;
	}> {
		const res = await fetch(`${apiBase(baseUrl)}/health`);
		if (!res.ok) throw new Error(`TTS server not reachable (${res.status})`);
		return (await res.json()) as { ready?: boolean; error?: string; model_id?: string };
	}

	async synthesize(
		text: string,
		baseUrl = this.defaultUrl,
		opts?: { voice?: string; speed?: number }
	): Promise<ArrayBuffer> {
		const res = await fetch(`${apiBase(baseUrl)}/tts`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				text,
				voice: opts?.voice ?? "",
				speed: opts?.speed ?? 1.0,
			}),
		});
		if (!res.ok) throw new Error(await parseError(res, `TTS failed (${res.status})`));
		return await res.arrayBuffer();
	}

	async downloadModel(modelId: string, baseUrl = this.defaultUrl): Promise<void> {
		const res = await fetch(`${apiBase(baseUrl)}/download`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model_id: modelId }),
		});
		if (!res.ok) throw new Error(await parseError(res, `Download failed (${res.status})`));
	}

	async loadModel(modelId: string, baseUrl = this.defaultUrl): Promise<void> {
		const res = await fetch(`${apiBase(baseUrl)}/models/load`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model_id: modelId }),
		});
		if (!res.ok) throw new Error(await parseError(res, `Load failed (${res.status})`));
	}
}
