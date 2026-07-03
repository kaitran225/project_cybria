import { parseError } from "../http";
import { ServiceClient } from "./base";

export class TtsClient extends ServiceClient {
	async ping(baseUrl = this.defaultUrl): Promise<{
		ready?: boolean;
		error?: string;
		model_id?: string;
	}> {
		return this.pingHealth(baseUrl);
	}

	async synthesize(
		text: string,
		baseUrl = this.defaultUrl,
		opts?: { voice?: string; speed?: number }
	): Promise<ArrayBuffer> {
		const res = await fetch(`${this.url(baseUrl)}/tts`, {
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
		return this.postDownload(modelId, baseUrl);
	}

	async loadModel(modelId: string, baseUrl = this.defaultUrl): Promise<void> {
		return this.postLoadModel(modelId, baseUrl);
	}
}
