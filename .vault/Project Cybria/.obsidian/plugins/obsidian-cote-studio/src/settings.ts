export interface CoteSettings {
  patternsFolder: string;
  useFullRepl: boolean;
}

export const DEFAULT_SETTINGS: CoteSettings = {
  patternsFolder: "Music/Patterns",
  useFullRepl: false,
};

export const DEFAULT_PATTERN = `// Cote Studio — Strudel pattern
s("bd sd, hh*8").bank("RolandTR909").gain(0.8)
`;
