import type { LoraCatalog } from "../apps/image/loras";
import type { ModelCatalog } from "../apps/image/models";
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

export interface ImageGenHealth extends ImageHealth {
	ready_to_generate?: boolean;
	model?: string;
	model_family?: string;
	device?: string;
	max_side?: number;
	lightning?: boolean;
	lora_directory?: string;
	active_style_lora?: string | null;
	config?: {
		model?: string;
		model_id?: string;
		max_side?: number;
		recommended_steps?: number;
		recommended_cfg?: number;
		recommended_size?: number;
	};
}

export interface ImageGenResult {
	imageBase64: string;
	seed: string;
	warnings?: string[];
	width?: number;
	height?: number;
	elapsedSec?: number;
	lora?: string | null;
	model?: string;
}

export interface ImageGenOptions {
	prompt: string;
	model?: string;
	width: number;
	height: number;
	steps?: number;
	cfg?: number;
	seed?: string;
	negativePrompt?: string;
	lora?: string;
	loraScale?: number;
}

export class ImageClient {
	constructor(private readonly defaultUrl: string) {}

	private url(baseUrl = this.defaultUrl): string {
		return apiBase(baseUrl);
	}

	async ping(baseUrl = this.defaultUrl): Promise<ImageHealth> {
		const res = await fetch(`${this.url(baseUrl)}/health`);
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

	/** Full health payload for the image gen UI (throws when HTTP fails). */
	async pingForGenerate(baseUrl = this.defaultUrl): Promise<ImageGenHealth> {
		const res = await fetch(`${this.url(baseUrl)}/health`);
		if (!res.ok) throw new Error(`Image server not reachable (${res.status})`);
		return (await res.json()) as ImageGenHealth;
	}

	async fetchModels(baseUrl = this.defaultUrl): Promise<ModelCatalog> {
		const res = await fetch(`${this.url(baseUrl)}/models`);
		if (!res.ok) throw new Error(`Model list failed (${res.status})`);
		return (await res.json()) as ModelCatalog;
	}

	async fetchLoras(modelId?: string, refresh = false, baseUrl = this.defaultUrl): Promise<LoraCatalog> {
		const params = new URLSearchParams();
		if (modelId) params.set("model", modelId);
		if (refresh) params.set("refresh", "1");
		const q = params.toString() ? `?${params}` : "";
		const res = await fetch(`${this.url(baseUrl)}/loras${q}`);
		if (!res.ok) throw new Error(`LoRA list failed (${res.status})`);
		return (await res.json()) as LoraCatalog;
	}

	async loadModel(modelId: string, baseUrl = this.defaultUrl): Promise<void> {
		const res = await fetch(`${this.url(baseUrl)}/models/load`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ model_id: modelId }),
		});
		if (!res.ok) throw new Error(await parseError(res, `Image load failed (${res.status})`));
	}

	async generate(
		opts: ImageGenOptions,
		timeoutMinutes = 0,
		baseUrl = this.defaultUrl
	): Promise<ImageGenResult> {
		const controller = new AbortController();
		const timeoutMs = timeoutMinutes > 0 ? timeoutMinutes * 60 * 1000 : 0;
		let timer = 0;
		if (timeoutMs > 0) {
			timer = window.setTimeout(() => controller.abort(), timeoutMs);
		}

		try {
			const body: Record<string, unknown> = {
				prompt: opts.prompt,
				model: opts.model || undefined,
				width: opts.width,
				height: opts.height,
				seed: opts.seed || undefined,
				steps: opts.steps,
				cfg: opts.cfg,
				negativePrompt: opts.negativePrompt,
			};
			if (opts.lora) {
				body.lora = opts.lora;
				body.loraScale = opts.loraScale ?? 0.85;
			}

			const res = await fetch(`${this.url(baseUrl)}/generate`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
				signal: controller.signal,
			});

			if (!res.ok) {
				let detail = `Generate failed (${res.status})`;
				try {
					const errBody = (await res.json()) as { detail?: string };
					if (errBody.detail) detail = errBody.detail;
				} catch {
					/* ignore */
				}
				throw new Error(detail);
			}

			return (await res.json()) as ImageGenResult;
		} catch (e) {
			if (
				(e instanceof DOMException && e.name === "AbortError") ||
				(e instanceof Error && /aborted/i.test(e.message))
			) {
				throw new Error(
					timeoutMinutes > 0
						? `Timed out after ${timeoutMinutes} min — the server may still be generating. Increase timeout in Settings, or set 0 for no limit.`
						: "Generation stopped — the server may still be working. Check the Server tab."
				);
			}
			throw e;
		} finally {
			if (timer) window.clearTimeout(timer);
		}
	}

	static decodeBase64Png(b64: string): ArrayBuffer {
		const binary = atob(b64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes.buffer;
	}
}
