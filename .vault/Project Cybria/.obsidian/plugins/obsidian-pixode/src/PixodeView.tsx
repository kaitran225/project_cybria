import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { PixodeApp } from "./ui/PixodeApp";
import type PixodePlugin from "./main";

export const VIEW_TYPE_PIXODE = "pixode-workspace";

export class PixodeView extends ItemView {
  private root: Root | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: PixodePlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_PIXODE;
  }

  getDisplayText(): string {
    return "Pixode";
  }

  getIcon(): string {
    return "grid";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("pixode-view-host");
    this.root = createRoot(container);
    this.root.render(<PixodeApp plugin={this.plugin} />);
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }
}
