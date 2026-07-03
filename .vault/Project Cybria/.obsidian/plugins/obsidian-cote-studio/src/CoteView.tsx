import { ItemView, WorkspaceLeaf } from "obsidian";
import { createRoot, type Root } from "react-dom/client";
import { CoteApp } from "./ui/CoteApp";
import type CotePlugin from "./main";

export const VIEW_TYPE_COTE = "cote-studio-workspace";

export class CoteView extends ItemView {
  private root: Root | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: CotePlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_COTE;
  }

  getDisplayText(): string {
    return "Cote Studio";
  }

  getIcon(): string {
    return "audio-lines";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("cote-view-host");
    this.root = createRoot(container);
    this.root.render(<CoteApp plugin={this.plugin} />);
  }

  async onClose(): Promise<void> {
    this.root?.unmount();
    this.root = null;
  }
}
