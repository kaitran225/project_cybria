import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { getSettings } from "src/plugin";

// Gemini's API rejects requests that combine built-in tools (like googleSearch)
// with function declarations, and the agent always registers the vault function
// tools. So instead of binding googleSearch to the agent's model, we expose web
// search as a regular tool: when the agent calls it, we spin up a fresh,
// isolated ChatGoogleGenerativeAI instance with ONLY googleSearch bound (no
// vault tools) and run the query through that, then hand the grounded result
// back to the agent as the tool's response.
export const googleWebSearchTool = tool(
  async ({ query }) => googleWebSearch(query),
  {
    name: "web_search",
    description: "Searches the web for up-to-date information using Google Search.",
    schema: z.object({
      query: z.string().describe("The search query."),
    }),
  }
);

interface GroundingSource {
  title?: string;
  url?: string;
}

async function googleWebSearch(query: string) {
  const settings = getSettings();

  if (!settings.googleApiKey.trim()) {
    return { success: false, response: "Set your Google API key in the plugin settings before using web search." };
  }

  try {
    const searchModel = new ChatGoogleGenerativeAI({
      model: settings.model,
      apiKey: settings.googleApiKey,
      baseUrl: settings.baseUrl.trim() || undefined,
    }).bindTools([{ googleSearch: {} }]);

    const result = await searchModel.invoke([new HumanMessage(query)]);

    // Grounding metadata (sources backing the search result) rides along on
    // additional_kwargs, the langchain integration doesn't model it explicitly.
    const groundingChunks = (result.additional_kwargs?.groundingMetadata as
      { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } | undefined
    )?.groundingChunks ?? [];

    const sources: GroundingSource[] = groundingChunks
      .map((chunk) => chunk.web)
      .filter((web): web is { uri?: string; title?: string } => Boolean(web))
      .map((web) => ({ title: web.title, url: web.uri }));

    if (!result.text) {
      return { success: false, response: "No results found." };
    }

    return {
      success: true,
      response: { search: result.text, sources },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, response: `Web search failed: ${message}` };
  }
}
