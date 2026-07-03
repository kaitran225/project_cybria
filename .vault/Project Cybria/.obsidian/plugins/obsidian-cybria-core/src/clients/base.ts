import { apiBase, parseError } from "../http";

export class ServiceClient {
	constructor(protected readonly defaultUrl: string) {}

	protected url(baseUrl = this.defaultUrl): string {
		return apiBase(baseUrl);
	}

	async pingHealth<T>(baseUrl = this.defaultUrl): Promise<T> {
		const res = await fetch(`${this.url(baseUrl)}/health`);
		if (!res.ok) throw new Error(`Server not reachable (${res.status})`);
		return (await res.json()) as T;
	}

	async postLoadModel(modelId: string, baseUrl = this.defaultUrl): Promise<void> {
		const res = await fetch(`${this.url(baseUrl)}/models/load`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model_id: modelId }),
		});
		if (!res.ok) throw new Error(await parseError(res, `Load failed (${res.status})`));
	}

	async postDownload(modelId: string, baseUrl = this.defaultUrl): Promise<void> {
		const res = await fetch(`${this.url(baseUrl)}/download`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model_id: modelId }),
		});
		if (!res.ok) throw new Error(await parseError(res, `Download failed (${res.status})`));
	}
}
