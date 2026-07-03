import { useEffect } from "react";
import { CoteEmbeddedContext } from "../../vendor/cote-src/cote-embedded.mjs";
import ReplEditor from "../../vendor/repl/components/ReplEditor.jsx";
import { useReplContext } from "../../vendor/repl/useReplContext.jsx";
import "../../vendor/repl/Repl.css";
import type CotePlugin from "../main";
import { configureVaultPatterns } from "../vault-pattern-fs";

function CoteReplInner({ plugin }: { plugin: CotePlugin }) {
  const context = useReplContext();

  useEffect(() => {
    void configureVaultPatterns(plugin.app, plugin.settings.patternsFolder);
  }, [plugin.app, plugin.settings.patternsFolder]);

  return <ReplEditor context={context} shellHeader />;
}

export function CoteReplPane({ plugin }: { plugin: CotePlugin }) {
  return (
    <CoteEmbeddedContext.Provider value={true}>
      <CoteReplInner plugin={plugin} />
    </CoteEmbeddedContext.Provider>
  );
}
