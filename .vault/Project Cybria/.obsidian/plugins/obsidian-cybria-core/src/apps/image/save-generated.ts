import type { GenerateProgress } from "./generate-options";
import { ImageClient } from "../../clients/image";
import type CybriaCorePlugin from "../../main";

export async function generateAndInsert(
	plugin: CybriaCorePlugin,
	prompt: string,
	opts: GenerateProgress | HTMLElement = {},
	legacyRefreshSidebar = false
): Promise<string> {
	const options: GenerateProgress =
		opts instanceof HTMLElement
			? { statusEl: opts, refreshSidebar: legacyRefreshSidebar }
			: opts;
	const { statusEl, refreshSidebar = false, onProgress } = options;

	const report = (pct: number, label: string) => {
		onProgress?.(pct, label);
		statusEl?.setText(label);
	};

	const s = plugin.settings.image;
	const imageUrl = plugin.api.serviceUrl("image");
	report(5, "Checking image server…");
	const health = await plugin.api.image.pingForGenerate(imageUrl);
	if (!health.ready_to_generate && !health.ready) {
		throw new Error(
			health.error || "Image server not ready. Open Cybria AI → Servers to launch."
		);
	}

	report(8, "Loading image model…");
	await plugin.api.ensureModelLoaded("image", { onLog: (l) => plugin.api.appendLog(l) });

	report(12, `Generating ${s.width}×${s.height}…`);
	const modelId = plugin.api.switcher.getActiveModel("image");
	const result = await plugin.api.image.generate(
		{
			prompt,
			model: modelId,
			width: s.width,
			height: s.height,
			steps: s.steps,
			cfg: s.cfg,
			seed: s.seed || undefined,
			negativePrompt: s.negativePrompt,
			lora: s.lora || undefined,
			loraScale: s.loraScale,
		},
		s.generateTimeoutMinutes,
		imageUrl
	);

	report(96, "Saving to vault…");
	const folder = s.outputFolder.replace(/\\/g, "/").replace(/\/+$/, "");
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const fileName = `${stamp}-seed${result.seed}.png`;
	const path = `${folder}/${fileName}`;

	if (!(await plugin.app.vault.adapter.exists(folder))) {
		await plugin.app.vault.createFolder(folder);
	}

	const bytes = ImageClient.decodeBase64Png(result.imageBase64);
	await plugin.app.vault.createBinary(path, bytes);

	plugin.addOutputRecord({
		path,
		prompt,
		seed: result.seed,
		createdAt: Date.now(),
	});

	if (!refreshSidebar) {
		const editor = plugin.app.workspace.activeEditor?.editor;
		if (editor) editor.replaceSelection(`![[${path}]]\n`);
	}

	return path;
}
