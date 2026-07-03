import { Notice } from "obsidian";
import { GenerateModal } from "./apps/image/GenerateModal";
import type { AppId } from "./apps/types";
import type { ModelSlot } from "./catalog";
import type CybriaCorePlugin from "./main";

export function registerCybriaCommands(plugin: CybriaCorePlugin): void {
	const openApp = (id: AppId) => () => void plugin.activateSwitcher("apps", id);

	plugin.addCommand({
		id: "open-dashboard",
		name: "Open Cybria AI home",
		callback: () => void plugin.activateSwitcher("dashboard"),
	});
	plugin.addCommand({
		id: "open-model-switcher",
		name: "Open Cybria AI",
		callback: () => void plugin.activateSwitcher(),
	});
	plugin.addCommand({
		id: "open-servers",
		name: "Open Cybria servers",
		callback: () => void plugin.activateSwitcher("servers"),
	});
	plugin.addCommand({ id: "open-llm", name: "Open Cybria Chat", callback: openApp("llm") });
	plugin.addCommand({ id: "open-novel", name: "Open Cybria Novel", callback: openApp("novel") });
	plugin.addCommand({ id: "open-audio", name: "Open Cybria Audio", callback: openApp("audio") });
	plugin.addCommand({ id: "open-image-gen", name: "Open Image Gen", callback: openApp("image") });

	plugin.addCommand({
		id: "activate-llm-model",
		name: "Load active LLM model",
		callback: () => void activateSlot(plugin, "llm"),
	});
	plugin.addCommand({
		id: "activate-image-model",
		name: "Load active image model",
		callback: () => void activateSlot(plugin, "image"),
	});

	plugin.addCommand({
		id: "chat-with-selection",
		name: "Chat with selection",
		editorCallback: (editor) => {
			const text = editor.getSelection().trim();
			void plugin.activateSwitcher("apps", "llm").then(() => {
				plugin.getSwitcherView()?.getAppsHost().getLlmPane().setInput(text);
			});
		},
	});

	plugin.addCommand({
		id: "continue-scene",
		name: "Continue scene from selection",
		editorCallback: (editor) => {
			const text = editor.getSelection().trim();
			void plugin.activateSwitcher("apps", "novel").then(() => {
				plugin.getSwitcherView()?.getAppsHost().getNovelPane().setWriteText(text);
			});
		},
	});

	plugin.addCommand({
		id: "summarize-selection",
		name: "Summarize selection",
		editorCallback: (editor) => {
			const text = editor.getSelection().trim();
			void plugin.activateSwitcher("apps", "novel").then(() => {
				plugin.getSwitcherView()?.getAppsHost().getNovelPane().setSummarizeText(text);
			});
		},
	});

	plugin.addCommand({
		id: "speak-selection",
		name: "Speak selection",
		editorCallback: (editor) => {
			const text = editor.getSelection().trim();
			void plugin.activateSwitcher("apps", "audio").then(() => {
				plugin.getSwitcherView()?.getAppsHost().getAudioPane().setText(text);
			});
		},
	});

	plugin.addCommand({
		id: "generate-image",
		name: "Generate image (modal)",
		callback: () => new GenerateModal(plugin.app, plugin).open(),
	});

	plugin.addCommand({
		id: "generate-from-selection",
		name: "Generate image from selection",
		editorCallback: (editor) => {
			const text = editor.getSelection().trim();
			void plugin.activateSwitcher("apps", "image").then(() => {
				plugin.getSwitcherView()?.getAppsHost().getImagePane().setPrompt(text);
			});
		},
	});
}

async function activateSlot(plugin: CybriaCorePlugin, slot: ModelSlot): Promise<void> {
	const modelId = plugin.settings.activeModels[slot];
	try {
		await plugin.api.switcher.activate(slot, modelId, { ensureServer: true });
		new Notice(`${slot} model loaded: ${modelId}`);
	} catch (e) {
		new Notice(`Failed: ${e instanceof Error ? e.message : e}`);
	}
}
