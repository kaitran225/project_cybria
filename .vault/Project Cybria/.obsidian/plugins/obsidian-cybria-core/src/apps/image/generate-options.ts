export interface GenerateProgress {
	onProgress?: (pct: number, label: string) => void;
	statusEl?: HTMLElement;
	refreshSidebar?: boolean;
}
