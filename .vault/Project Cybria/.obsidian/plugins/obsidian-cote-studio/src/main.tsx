import "../styles.css";
import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { CoteView, VIEW_TYPE_COTE } from "./CoteView";
import { DEFAULT_SETTINGS, type CoteSettings } from "./settings";
import { createPattern } from "./vault-patterns";
import { DEFAULT_PATTERN } from "./settings";

export default class CotePlugin extends Plugin {
  settings: CoteSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_COTE, (leaf) => new CoteView(leaf, this));

    this.addRibbonIcon("audio-lines", "Open Cote Studio", () => void this.activateView());

    this.addCommand({
      id: "open-cote-studio",
      name: "Open Cote Studio",
      callback: () => void this.activateView(),
    });

    this.addCommand({
      id: "new-strudel-pattern",
      name: "New Strudel pattern",
      callback: () => void this.newPattern(),
    });

    this.addSettingTab(new CoteSettingTab(this.app, this));
  }

  async onunload(): Promise<void> {
    const { stopPattern } = await import("./strudel-runtime");
    await stopPattern();
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_COTE)[0];
    if (!leaf) {
      const right = workspace.getRightLeaf(false);
      if (!right) return;
      await right.setViewState({ type: VIEW_TYPE_COTE, active: true });
      leaf = right;
    }
    await workspace.revealLeaf(leaf);
  }

  async newPattern(): Promise<void> {
    await createPattern(this.app, this.settings.patternsFolder, "pattern", DEFAULT_PATTERN);
    await this.activateView();
  }
}

class CoteSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: CotePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("Patterns folder")
      .setDesc("Vault folder for .strudel pattern files.")
      .addText((t) =>
        t.setValue(this.plugin.settings.patternsFolder).onChange(async (v) => {
          this.plugin.settings.patternsFolder = v.trim() || DEFAULT_SETTINGS.patternsFolder;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Full Strudel REPL")
      .setDesc(
        "CodeMirror editor with side panels, pianoroll, and block evaluation. " +
          "Requires repl-chunk.js in the plugin folder (shipped by npm run build). " +
          "Reload this view after toggling."
      )
      .addToggle((t) =>
        t.setValue(this.plugin.settings.useFullRepl).onChange(async (v) => {
          this.plugin.settings.useFullRepl = v;
          await this.plugin.saveSettings();
        })
      );

    const notes = containerEl.createDiv({ cls: "cote-settings-notes" });
    notes.createEl("h4", { text: "Full REPL notes" });
    const list = notes.createEl("ul");
    const items = [
      "Soundfonts (sfumato) and several Strudel extensions (MIDI, Csound, Tidal, MQTT, serial, gamepad, etc.) are not bundled. CDN drum machines, synths, and core mini notation still work.",
      "Cross-instance sync is off by default (isSyncEnabled: false), so NeoCyclist / SharedWorker is not used in Obsidian Electron.",
      "Ship both main.js and repl-chunk.js when distributing or copying the plugin. Simple editor mode only needs main.js.",
    ];
    for (const text of items) {
      list.createEl("li", { text });
    }
  }
}
