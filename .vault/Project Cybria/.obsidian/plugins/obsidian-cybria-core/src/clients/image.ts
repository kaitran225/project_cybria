import { apiBase, parseError } from "../http";

export interface ImageModelEntry {
	id: string;
	name: string;
	family?: string;
}

export interface ImageHealth {
	ready?: boolean;
	loading?: boolean;
	model_id?: string;
	model_name?: string;
	error?: string | null;
}

export class ImageClient {
	constructor(private readonly defaultUrl: string) {}

	async ping(baseUrl = this.defaultUrl): Promise<ImageHealth> {
		const res = await fetch(`${apiBase(baseUrl)}/health`);
		if (res.status === 503 || res.status === 504) {
			try {
				const body = (await res.json()) as ImageHealth & { detail?: string };
				return {
					ready: false,
					loading: body.loading ?? true,
					model_id: body.model_id,
					model_name: body.model_name,
					error: body.error ?? body.detail ?? null,
				};
			} catch {
				return { ready: false, loading: true };
			}
		}
		if (!res.ok) throw new Error(`Image server not reachable (${res.status})`);
		return (await res.json()) as ImageHealth;
	}

	async fetchModels(baseUrl = this.defaultUrl): Promise<{
		models: ImageModelEntry[];
		default: string;
		loaded?: string | null;
	}> {
		const res = await fetch(`${apiBase(baseUrl)}/models`);
		if (!res.ok) throw new Error(`Image models failed (${res.status})`);
		return (await res.json()) as {
			models: ImageModelEntry[];
			default: string;
			loaded?: string | null;
		};
	}

	async loadModel(modelId: string, baseUrl = this.defaultUrl): Promise<void> {
		const res = await fetch(`${apiBase(baseUrl)}/models/load`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model_id: modelId }),
		});
		if (!res.ok) throw new Error(await parseError(res, `Image load failed (${res.status})`));
	}
}
