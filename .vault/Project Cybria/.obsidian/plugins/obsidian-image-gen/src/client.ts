export interface ImageGenHealth {
	ready?: boolean;
	ready_to_generate?: boolean;
	loading?: boolean;
	model?: string;
	device?: string;
	max_side?: number;
	error?: string | null;
	config?: {
		model?: string;
		max_side?: number;
		host?: string;
		port?: number;
	};
}

export interface ImageGenResult {
	imageBase64: string;
	seed: string;
	warnings?: string[];
}

export interface ImageGenOptions {
	prompt: string;
	width: number;
	height: number;
	steps?: number;
	cfg?: number;
	seed?: string;
	negativePrompt?: string;
}

function base(url: string): string {
	return url.replace(/\/+$/, "");
}

export async function pingServer(baseUrl: string): Promise<ImageGenHealth> {
	const res = await fetch(`${base(baseUrl)}/health`);
	if (!res.ok) {
		throw new Error(`Image server not reachable (${res.status})`);
	}
	return (await res.json()) as ImageGenHealth;
}

export async function generateImage(
	baseUrl: string,
	opts: ImageGenOptions
): Promise<ImageGenResult> {
	const controller = new AbortController();
	const timeout = window.setTimeout(() => controller.abort(), 10 * 60 * 1000);

	try {
		const res = await fetch(`${base(baseUrl)}/generate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				prompt: opts.prompt,
				width: opts.width,
				height: opts.height,
				seed: opts.seed || undefined,
				steps: opts.steps,
				cfg: opts.cfg,
				negativePrompt: opts.negativePrompt,
			}),
			signal: controller.signal,
		});

		if (!res.ok) {
			let detail = `Generate failed (${res.status})`;
			try {
				const body = (await res.json()) as { detail?: string };
				if (body.detail) detail = body.detail;
			} catch {
				// ignore
			}
			throw new Error(detail);
		}

		return (await res.json()) as ImageGenResult;
	} finally {
		window.clearTimeout(timeout);
	}
}

export function decodeBase64Png(b64: string): ArrayBuffer {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}
