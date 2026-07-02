import type { CybriaServiceKey } from "./servers";

export type ServiceHealthState = "offline" | "stopped" | "loading" | "ready" | "error";

export interface ParsedServiceHealth {
	state: ServiceHealthState;
	label: string;
	model: string;
	detail: string;
}

export function parseServiceHealth(raw: Record<string, unknown> | undefined): ParsedServiceHealth {
	if (!raw) {
		return { state: "offline", label: "offline", model: "—", detail: "No health data" };
	}
	if (typeof raw.error === "string" && raw.error) {
		return {
			state: "error",
			label: "error",
			model: String(raw.model_id ?? raw.model_name ?? "—"),
			detail: raw.error,
		};
	}
	if (raw.loading) {
		return {
			state: "loading",
			label: "loading",
			model: String(raw.model_id ?? raw.model_name ?? "—"),
			detail: "Model is loading…",
		};
	}
	if (raw.ready) {
		return {
			state: "ready",
			label: "ready",
			model: String(raw.model_id ?? raw.model_name ?? "—"),
			detail: "Service ready",
		};
	}
	return {
		state: "stopped",
		label: "idle",
		model: String(raw.model_id ?? raw.model_name ?? "—"),
		detail: "",
	};
}

export function formatStatusLabel(label: string): string {
	switch (label) {
		case "starting":
			return "Starting";
		case "loading":
			return "Loading";
		case "ready":
			return "Ready";
		case "idle":
			return "Idle";
		case "offline":
			return "Offline";
		case "error":
			return "Error";
		default:
			return label.charAt(0).toUpperCase() + label.slice(1);
	}
}

export function serviceHealthClass(state: ServiceHealthState): string {
	return `ccore-svc-${state}`;
}

export const SERVICE_ORDER: CybriaServiceKey[] = ["llm", "summarize", "tts", "image"];
