import { AIMessage, BaseMessage, ContentBlock, HumanMessage, ToolMessage } from "@langchain/core/messages";
import { getSettings } from "src/plugin";
import { imageToBase64 } from "src/utils/parsing/imageBase64";
import { Message } from "src/types/chat";

// Multimodal content blocks accepted by a HumanMessage (LangChain v1 content-block model)
export type UserContentBlock = ContentBlock.Text | ContentBlock.Multimodal.Image;

// `imageToBase64` reads the file as a data URL (`data:<mime>;base64,<data>`);
// this splits it into the `mimeType`/`data` pair the Image content block expects.
const DATA_URL_PATTERN = /^data:([^;,]+);base64,(.*)$/;

// Function that prepares the prompt into multimodal content blocks for a HumanMessage
// This function only manages text and files, tool calls are not handled here
// Look how to handle tool calls in buildChatHistory
export async function prepareModelInputs(
  user: string,
  files: File[],
): Promise<UserContentBlock[]> {
  const blocks: UserContentBlock[] = [{ type: "text", text: user }];

  for (const file of files) {
    const dataUrl = await imageToBase64(file);
    const match = DATA_URL_PATTERN.exec(dataUrl);
    if (!match) continue;

    const [, mimeType, data] = match;
    blocks.push({ type: "image", mimeType, data });
  }

  return blocks;
}


// Function that builds the chat history as LangChain messages
export async function buildChatHistory(
  conversation: Message[],
): Promise<BaseMessage[]> {
  const settings = getSettings();
  const maxHistoryTurns = settings.maxHistoryTurns;

  if (maxHistoryTurns === 0) return [];

  const chatHistory: BaseMessage[] = [];
  let selectedMessages: Message[] = conversation.slice(-maxHistoryTurns*2);
  // Reverse to process the messages in the order they were sent
  selectedMessages = selectedMessages.reverse();

  for (const message of selectedMessages) {
    if (message.sender === "error") continue;

    // We need to include the tool call (AI) and its result (tool)
    // per tool call made by the model
    if (message.toolCalls.length > 0) {
      for (const [index, toolCall] of message.toolCalls.entries()) {
        // History tool calls don't carry an id, synthesize a stable one for pairing
        const callId = `${toolCall.name}-${chatHistory.length}-${index}`;

        chatHistory.push(new AIMessage({
          content: "",
          tool_calls: [{
            name: toolCall.name,
            args: toolCall.args ?? {},
            id: callId,
          }],
        }));

        chatHistory.push(new ToolMessage({
          tool_call_id: callId,
          name: toolCall.name,
          content: JSON.stringify(toolCall.response ?? {}),
        }));
      }

      if (message.content.trim().length > 0) {
        chatHistory.push(new AIMessage(message.content));
      }
    } else {
      if (message.sender === "user") {
        const blocks = await prepareModelInputs(message.content, []);
        chatHistory.push(new HumanMessage({ content: blocks }));
      } else {
        chatHistory.push(new AIMessage(message.content));
      }
    }
  }

  // Reverse back to original order
  chatHistory.reverse();

  return chatHistory;
}
