import type { CybriaCoreApi } from "./api";
import {
	catalyze,
	combineHitsForSummarize,
	formatHitsForDisplay,
	isEnzymeIndexed,
	enzymeAvailable,
	type CatalyzeHit,
	type CatalyzeResponse,
} from "./enzyme/catalyze";

export interface SemanticSummarizeOptions {
	query: string;
	limit?: number;
	modelId?: string;
	summarizeUrl?: string;
	/** Direct text bypasses enzyme (selection mode). */
	directText?: string;
}

export interface SemanticSummarizeResult {
	summary: string;
	sources: CatalyzeHit[];
	sourcesText: string;
	mode: "semantic" | "direct";
	partials?: string[];
}

const CHUNK_CAP = 900;
const COMBINE_CAP = 3800;

export class SemanticSummarizer {
	constructor(private readonly api: CybriaCoreApi) {}

	vaultPath(): string {
		return this.api.vaultPath();
	}

	async isAvailable(): Promise<{ enzyme: boolean; indexed: boolean }> {
		const vault = this.vaultPath();
		return {
			enzyme: await enzymeAvailable(),
			indexed: isEnzymeIndexed(vault),
		};
	}

	async search(query: string, limit = 5): Promise<CatalyzeResponse> {
		return catalyze(this.vaultPath(), query, limit);
	}

	/**
	 * Semantic summarize: enzyme catalyze → map BART/PEGASUS per hit → reduce.
	 * Direct mode: summarize pasted/selected text only.
	 */
	async summarize(opts: SemanticSummarizeOptions): Promise<SemanticSummarizeResult> {
		const modelId = opts.modelId ?? this.api.switcher.getActiveModel("summarize");
		const sumUrl = opts.summarizeUrl ?? this.api.serverUrl("summarize");

		if (opts.directText?.trim()) {
			const text = opts.directText.trim();
			const summary = await this.api.summarize.summarize(text, modelId, sumUrl);
			return {
				summary,
				sources: [],
				sourcesText: "",
				mode: "direct",
			};
		}

		const query = opts.query.trim();
		if (!query) throw new Error("Enter a topic query or text to summarize");

		const response = await catalyze(this.vaultPath(), query, opts.limit ?? 5);
		if (response.results.length === 0) {
			throw new Error(
				`No vault notes matched "${query}". Try rephrasing or run enzyme init/refresh.`
			);
		}

		const sourcesText = formatHitsForDisplay(response.results);
		const partials: string[] = [];

		for (const hit of response.results) {
			const chunk = `Note: ${hit.relativePath}\n${hit.content}`.slice(0, CHUNK_CAP);
			const part = await this.api.summarize.summarize(chunk, modelId, sumUrl);
			partials.push(`**${hit.relativePath}**: ${part}`);
		}

		const combined = `Topic: ${query}\n\n${partials.join("\n\n")}`;
		let summary: string;
		if (combined.length <= CHUNK_CAP) {
			summary = combined;
		} else {
			const reduceInput = combineHitsForSummarize(
				response.results.map((h, i) => ({
					...h,
					content: partials[i] ?? h.content,
				})),
				COMBINE_CAP
			);
			const preamble = `Synthesize a single summary for the vault topic "${query}" from these note summaries:\n\n`;
			summary = await this.api.summarize.summarize(
				(preamble + reduceInput).slice(0, CHUNK_CAP),
				modelId,
				sumUrl
			);
		}

		return {
			summary,
			sources: response.results,
			sourcesText,
			mode: "semantic",
			partials,
		};
	}
}
