import { parseError } from "../http";
import { ServiceClient } from "./base";

export class SummarizeClient extends ServiceClient {
	async ping(baseUrl = this.defaultUrl): Promise<{ ready?: boolean; error?: string }> {
		return this.pingHealth(baseUrl);
	}

	async summarize(text: string, modelId: string, baseUrl = this.defaultUrl): Promise<string> {
		const res = await fetch(`${this.url(baseUrl)}/summarize`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text, model_id: modelId }),
		});
		if (!res.ok) throw new Error(await parseError(res, `Summarize failed (${res.status})`));
		const data = (await res.json()) as { summary: string };
		return data.summary;
	}

	async downloadModel(modelId: string, baseUrl = this.defaultUrl): Promise<void> {
		return this.postDownload(modelId, baseUrl);
	}

	async loadModel(modelId: string, baseUrl = this.defaultUrl): Promise<void> {
		return this.postLoadModel(modelId, baseUrl);
	}
}
