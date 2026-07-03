import type { LayerGrid } from "../layer-grid.js";

export class LayerGridCommand {
  readonly label: string;
  private readonly before: Int16Array;
  private readonly after: Int16Array;
  private readonly apply: (data: Int16Array) => void;

  constructor(
    label: string,
    before: LayerGrid,
    after: LayerGrid,
    apply: (data: Int16Array) => void
  ) {
    this.label = label;
    this.before = before.cloneData();
    this.after = after.cloneData();
    this.apply = apply;
  }

  execute(): void {
    this.apply(this.after);
  }

  undo(): void {
    this.apply(this.before);
  }
}
