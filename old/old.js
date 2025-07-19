import { generateText } from "npm:ai";
import { google } from "npm:@ai-sdk/google";

const SYSTEM_PROMPT = "You are a mean AI";

while (true) {
  const userPrompt = prompt("You: ");
  const fullPrompt = SYSTEM_PROMPT + `--- Prompt ---\n${userPrompt}\n + --- Response ---\n`;

  const { text } = await generateText({
    model: google("models/gemini-2.5-flash"),
    prompt: fullPrompt,
  });
  console.log(text);
}
