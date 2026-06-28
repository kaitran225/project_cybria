import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { prepareModelInputs } from "src/backend/managers/prompts/inputs";
import { agentSystemPrompt } from "src/backend/managers/prompts/library";
import { buildChatModel, translateModelError } from "src/backend/managers/modelFactory";


// Function that calls the llm model without chat history and tools binded
export async function callModel(
  system: string,
  user: string,
  files: File[],
): Promise<string> {
  const model = buildChatModel();
  const content = await prepareModelInputs(user, files);

  try {
    const response = await model.invoke([
      new SystemMessage(system || agentSystemPrompt),
      new HumanMessage({ content }),
    ]);

    return response.text;

  } catch (error) {
    throw translateModelError(error);
  }
}
