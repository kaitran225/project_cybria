import { apiBase, parseError } from "../http";

export class SummarizeClient {
	constructor(private readonly defaultUrl: string) {}

	async ping(baseUrl = this.defaultUrl): Promise<{ ready?: boolean; error?: string }> {
		const res = await fetch(`${apiBase(baseUrl)}/health`);
		if (!res.ok) throw new Error(`Summarize server not reachable (${res.status})`);
		return (await res.json()) as { ready?: boolean; error?: string };
	}

	async summarize(text: string, modelId: string, baseUrl = this.defaultUrl): Promise<string> {
		const res = await fetch(`${apiBase(baseUrl)}/summarize`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text, model_id: modelId }),
		});
		if (!res.ok) throw new Error(await parseError(res, `Summarize failed (${res.status})`));
		const data = (await res.json()) as { summary: string };
		return data.summary;
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
