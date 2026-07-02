export interface AudioSettings {
	serverUrl: string;
	toolsPath: string;
	outputFolder: string;
	terminalHeight: number;
	activeTab: "speak" | "server";
}

export const DEFAULT_SETTINGS: AudioSettings = {
	serverUrl: "http://127.0.0.1:8792",
	toolsPath: "",
	outputFolder: "Generated/Audio",
	terminalHeight: 160,
	activeTab: "speak",
};
