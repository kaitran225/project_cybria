import "../styles.css";
import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { PixodeView, VIEW_TYPE_PIXODE } from "./PixodeView";
import { DEFAULT_SETTINGS, type PixodeSettings } from "./settings";

export default class PixodePlugin extends Plugin {
  settings: PixodeSettings = { ...DEFAULT_SETTINGS };

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(VIEW_TYPE_PIXODE, (leaf) => new PixodeView(leaf, this));

    this.addRibbonIcon("grid", "Open Pixode", () => void this.activateView());

    this.addCommand({
      id: "open-pixode",
      name: "Open Pixode",
      callback: () => void this.activateView(),
    });

    this.addCommand({
      id: "new-pixel-asset",
      name: "New pixel asset",
      callback: () => void this.activateView(),
    });

    this.addSettingTab(new PixodeSettingTab(this.app, this));
  }

  async loadSettings(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_PIXODE)[0];
    if (!leaf) {
      const right = workspace.getRightLeaf(false);
      if (!right) return;
      await right.setViewState({ type: VIEW_TYPE_PIXODE, active: true });
      leaf = right;
    }
    await workspace.revealLeaf(leaf);
  }
}

class PixodeSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: PixodePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("Project folder")
      .setDesc("Vault path for pixode.project.json and assets.")
      .addText((t) =>
        t.setValue(this.plugin.settings.projectRoot).onChange(async (v) => {
          this.plugin.settings.projectRoot = v.trim() || DEFAULT_SETTINGS.projectRoot;
          await this.plugin.saveSettings();
        })
      );
  }
}
