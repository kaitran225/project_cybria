import { parseError } from "../http";
import { ServiceClient } from "./base";

export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface ChatOptions {
	model?: string;
	temperature?: number;
	maxTokens?: number;
	systemPrompt?: string;
}

export interface LlmHealth {
	ready?: boolean;
	loading?: boolean;
	model_id?: string;
	error?: string | null;
}

async function* readSseStream(res: Response): AsyncGenerator<string> {
	const reader = res.body?.getReader();
	if (!reader) throw new Error("No response stream");
	const decoder = new TextDecoder();
	let buffer = "";
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed.startsWith("data:")) continue;
			const payload = trimmed.slice(5).trim();
			if (payload === "[DONE]") return;
			try {
				const json = JSON.parse(payload) as {
					choices?: Array<{ delta?: { content?: string } }>;
				};
				const chunk = json.choices?.[0]?.delta?.content;
				if (chunk) yield chunk;
			} catch {
				/* skip */
			}
		}
	}
}

export class LlmClient extends ServiceClient {
	async ping(baseUrl = this.defaultUrl): Promise<LlmHealth> {
		return this.pingHealth<LlmHealth>(baseUrl);
	}

	async loadModel(modelId: string, baseUrl = this.defaultUrl): Promise<void> {
		return this.postLoadModel(modelId, baseUrl);
	}

	async downloadModel(modelId: string, baseUrl = this.defaultUrl): Promise<void> {
		return this.postDownload(modelId, baseUrl);
	}

	async *streamChat(
		messages: ChatMessage[],
		opts: ChatOptions,
		baseUrl = this.defaultUrl,
		signal?: AbortSignal
	): AsyncGenerator<string> {
		const apiMessages: ChatMessage[] = [];
		if (opts.systemPrompt?.trim()) {
			apiMessages.push({ role: "system", content: opts.systemPrompt.trim() });
		}
		apiMessages.push(...messages);

		const res = await fetch(`${this.url(baseUrl)}/v1/chat/completions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model: opts.model || "default",
				messages: apiMessages,
				stream: true,
				temperature: opts.temperature ?? 0.7,
				max_tokens: opts.maxTokens ?? 2048,
			}),
			signal,
		});
		if (!res.ok) throw new Error(await parseError(res, `Chat failed (${res.status})`));
		yield* readSseStream(res);
	}

	async *streamContinue(
		context: string,
		systemPrompt: string,
		modelId: string,
		baseUrl = this.defaultUrl,
		signal?: AbortSignal
	): AsyncGenerator<string> {
		yield* this.streamChat(
			[{ role: "user", content: `Continue from here:\n\n${context}` }],
			{ model: modelId, systemPrompt, temperature: 0.8, maxTokens: 2048 },
			baseUrl,
			signal
		);
	}
}
