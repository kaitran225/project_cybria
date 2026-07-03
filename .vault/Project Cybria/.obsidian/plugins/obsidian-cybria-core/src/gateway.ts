import type { CybriaCoreApi } from "./api";
import { CYBRIA_PORT } from "./servers";

export interface EnsureGatewayOptions {
	onLog?: (line: string) => void;
	timeoutMs?: number;
	/** When true, only detect an external gateway — do not launch. */
	detectOnly?: boolean;
}

/**
 * Ensure the unified cybria-server gateway is reachable.
 * Launches the local process when needed and polls until /health responds.
 */
export async function ensureGatewayRunning(
	api: CybriaCoreApi,
	opts: EnsureGatewayOptions = {}
): Promise<void> {
	const log = opts.onLog ?? ((line: string) => api.appendLog(line));
	const timeoutMs = opts.timeoutMs ?? 30_000;

	if (api.isGatewayRunning()) return;

	const existing = await api.fetchGatewayHealth();
	if (existing) {
		log(`[gateway] already answering on :${CYBRIA_PORT}`);
		return;
	}

	if (opts.detectOnly) {
		throw new Error("Cybria server not running — launch gateway first");
	}

	log(`[gateway] launching cybria-server on :${CYBRIA_PORT}`);
	api.runner().launchServer(api.resolveToolsDir("gateway"), log);

	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, 1000));
		if (await api.fetchGatewayHealth()) {
			log(`[gateway] is up`);
			return;
		}
	}
	throw new Error(`gateway did not come up within ${Math.round(timeoutMs / 1000)}s — check logs`);
}
