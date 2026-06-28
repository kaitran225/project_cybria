import { createAgent } from "langchain";
import { HumanMessage } from "@langchain/core/messages";
import { ClientTool, ServerTool } from "@langchain/core/tools";
import { getSettings } from "src/plugin";
import { Attachment, Message, ToolCall } from "src/types/chat";
import { buildChatHistory, prepareModelInputs } from "src/backend/managers/prompts/inputs";
import { agentSystemPrompt } from "src/backend/managers/prompts/library";
import { vaultTools } from "src/backend/managers/functionRunner";
import { buildChatModel, getNativeWebSearchTool, translateModelError } from "src/backend/managers/modelFactory";
import { googleWebSearchTool } from "src/backend/tools/webSearch";

// Agent loop turn cap (model call <-> tool call cycles). createAgent/LangGraph
// aborts with a clear error past this depth, replacing the old manual guard.
const RECURSION_LIMIT = 25;

// Function that calls the agent with chat history and tools binded
export async function callAgent(
  conversation: Message[],
  message: string,
  attachments: Attachment[],
  files: File[],
  updateAiMessage: (m: string, r: string, t: ToolCall[]) => void,
): Promise<void> {
  const settings = getSettings();

  try {
    const model = buildChatModel();
    const webSearchTool = getNativeWebSearchTool(settings.provider);
    // Gemini can't bind googleSearch alongside the vault function tools, so it
    // gets a dedicated tool that runs the search through a separate, isolated model.
    const searchTools: (ClientTool | ServerTool)[] = webSearchTool
      ? [webSearchTool]
      : settings.provider === "google"
        ? [googleWebSearchTool]
        : [];

    const agent = createAgent({
      model,
      tools: [...vaultTools, ...searchTools],
      systemPrompt: settings.rules ? `${agentSystemPrompt}\n${settings.rules}` : agentSystemPrompt,
    });

    const history = conversation.length > 0 ? await buildChatHistory(conversation) : [];

    // Append attached note paths so the model knows which notes were referenced
    let fullUserMessage = message;
    if (attachments.length > 0) {
      fullUserMessage += `\n###\nAttached Obsidian notes: `;
      for (const note of attachments) {
        fullUserMessage += `\n${note.path}`;
      }
      fullUserMessage += `\n###\n`;
    }

    const content = await prepareModelInputs(fullUserMessage, files);
    const userMessage = new HumanMessage({ content });

    const run = await agent.streamEvents(
      { messages: [...history, userMessage] },
      { version: "v3", recursionLimit: RECURSION_LIMIT },
    );

    // Stream the assistant's text and reasoning deltas as they're generated
    const messagesTask = (async () => {
      for await (const msg of run.messages) {
        await Promise.all([
          (async () => {
            for await (const token of msg.text) {
              updateAiMessage(token, "", []);
            }
          })(),
          (async () => {
            for await (const token of msg.reasoning) {
              updateAiMessage("", token, []);
            }
          })(),
        ]);
      }
    })();

    // Stream completed tool calls and their results as they finish
    const toolCallsTask = (async () => {
      for await (const call of run.toolCalls) {
        let response: Record<string, unknown>;
        try {
          response = (await call.output) as Record<string, unknown>;
        } catch {
          response = { error: (await call.error) ?? "Tool call failed." };
        }

        updateAiMessage("", "", [{
          name: call.name,
          args: (call.input ?? {}) as Record<string, unknown>,
          response: response ?? {},
        }]);
      }
    })();

    await Promise.all([messagesTask, toolCallsTask]);
    await run.output;
  } catch (error) {
    throw translateModelError(error);
  }
}
