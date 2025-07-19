// When running without deno (I use deno)
// require("dotenv").config();
// const { GOOGLE_GENERATIVE_AI_API_KEY } = process.env;

import { google } from "npm:@ai-sdk/google";
import { generateText } from "npm:ai";

let TOKENOUT = 12288;

const JOKEBOT_MODE = Deno.args.includes("-j");
const LESBIAN_MODE = Deno.args.includes("-l");
const FLASHARG = Deno.args.includes("-flash");

let SYSTEM_PROMPT;
let MODEL;
let TEMP = 1;

if (FLASHARG) {
  MODEL = "gemini-2.5-flash";
} else {
  MODEL = "gemini-2.5-flash-lite-preview-06-17";
}

if (JOKEBOT_MODE) {
  SYSTEM_PROMPT = await Deno.readTextFile("./prompts/jokebot2.txt");
  TEMP = 1.15;
} else if (LESBIAN_MODE) {
  SYSTEM_PROMPT = await Deno.readTextFile("./prompts/lesbian.txt");
  TEMP = 1.15;
} else {
  SYSTEM_PROMPT = await Deno.readTextFile("./prompts/default.txt");
}

// File and Directory Paths
const HISTORY_DIR = "./histories/";
const CURRENT_SESSION_FILE_PATH = HISTORY_DIR + "current_chat_session.txt";
const JOKEBOT_HISTORY_FILE_PATH = HISTORY_DIR + "jokebot_history.txt";

/**
 * Ensures the history directory exists.
 */
async function ensureHistoryDirectoryExists() {
  try {
    await Deno.mkdir(HISTORY_DIR, { recursive: true });
  } catch (error) {
    if (error instanceof Deno.errors.AlreadyExists) {
      // Directory already exists, no need to do anything
    } else {
      console.error(`Failed to create history directory: ${error.message}`);
      throw error; // Re-throw to indicate a critical error
    }
  }
}

/**
 * Loads the existing chat history from the current session file.
 * @returns {Promise<string>} The chat history content or an empty string if the file doesn\'t exist.
 */
async function loadChatHistory(filePath = CURRENT_SESSION_FILE_PATH) {
  try {
    return await Deno.readTextFile(filePath);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return ""; // File does not exist, return empty history
    }
    console.error(`Failed to load chat history from ${filePath}: ${error.message}`);
    return ""; // Return empty on other errors
  }
}

/**
 * Appends the new prompt and response to the current chat session file.
 * @param {string} prompt The user\'s prompt.
 * @param {string} response The AI\'s response.
 */
async function saveChatSession(prompt, response, filePath = CURRENT_SESSION_FILE_PATH) {
  const content = `--- PROMPT ---\n${prompt}\n--- RESPONSE ---\n${response}\n\n`;
  try {
    await ensureHistoryDirectoryExists(); // Ensure directory exists before saving
    // Deno.writeTextFile requires --allow-write permission when running with Deno
    await Deno.writeTextFile(filePath, content, {
      append: true,
    });
    console.log(`Chat session saved to ${filePath}`);
  } catch (error) {
    console.error(`Failed to save chat session to ${filePath}: ${error.message}`);
  }
}

/**
 * Generates a timestamped filename for archiving.
 * @returns {string} A string like 'chat_history_YYYY-MM-DD_HH-MM-SS.txt'
 */
function getTimestampedFilename() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `chat_history_${year}-${month}-${day}_${hours}-${minutes}-${seconds}.txt`;
}

/**
 * Deletes the current chat session file.
 */
async function deleteCurrentChatSession(filePath = CURRENT_SESSION_FILE_PATH) {
  try {
    await Deno.remove(filePath);
    console.log(`File ${filePath} deleted.`);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.log(`No file ${filePath} to delete.`);
    } else {
      console.error(`Failed to delete ${filePath}: ${error.message}`);
    }
  }
}

/**
 * Lists all timestamped chat history files in the histories directory.
 * @returns {Promise<string[]>} An array of history filenames.
 */
async function listHistoryFiles() {
  const historyFiles = [];
  try {
    for await (const dirEntry of Deno.readDir(HISTORY_DIR)) {
      if (
        dirEntry.isFile &&
        dirEntry.name.startsWith("chat_history_") &&
        dirEntry.name.endsWith(".txt")
      ) {
        historyFiles.push(dirEntry.name);
      }
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      // Directory doesn't exist yet, return empty list
      return [];
    }
    console.error(`Failed to list history files: ${error.message}`);
  }
  return historyFiles.sort(); // Sort alphabetically for consistent ordering
}

async function main() {
  await ensureHistoryDirectoryExists(); // Ensure history directory exists at startup

  let currentChatHistory = "";

  console.log("Welcome to the AI chat!");

  if (JOKEBOT_MODE) {
    console.log("Jokebot Mode enabled. Loading persistent chat history...");
    currentChatHistory = await loadChatHistory(JOKEBOT_HISTORY_FILE_PATH);
    if (currentChatHistory === "") {
      console.log("No existing Jokebot history found. Starting fresh!");
    }
    // In Jokebot mode, we don't use the temporary current_chat_session.txt
    // We also don't offer to delete it or load other histories.
  } else {
    // Standard chat mode logic
    await deleteCurrentChatSession(); // Ensure temporary file is clean for new session

    const availableHistories = await listHistoryFiles();

    // If there are saved histories, ask the user if they want to load one
    if (availableHistories.length > 0) {
      console.log("Available chat histories:");
      availableHistories.forEach((file, index) => {
        console.log(`${index + 1}. ${file}`);
      });

      const loadOption = prompt(
        "Do you want to load a previous chat history? Enter number or 'n' for new chat: ",
      );

      if (loadOption && loadOption.toLowerCase() !== "n") {
        const selectedIndex = parseInt(loadOption) - 1;
        if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < availableHistories.length) {
          const selectedFile = availableHistories[selectedIndex];
          const selectedFilePath = HISTORY_DIR + selectedFile;
          try {
            currentChatHistory = await loadChatHistory(selectedFilePath);
            // Overwrite the current session file with the loaded history to continue appending to it
            await Deno.writeTextFile(CURRENT_SESSION_FILE_PATH, currentChatHistory, {
              create: true,
              overwrite: true,
            });
            console.log(`Loaded chat history from '${selectedFile}'.`);
          } catch (error) {
            console.error(`Failed to load selected history: ${error.message}`);
            console.log("Starting a new chat session instead.");
            // No need to delete CURRENT_SESSION_FILE_PATH again, as it's handled at the start
          }
        } else {
          console.log("Invalid selection. Starting a new chat session.");
          // No need to delete CURRENT_SESSION_FILE_PATH again
        }
      } else {
        console.log("Starting a new chat session.");
        // No need to delete CURRENT_SESSION_FILE_PATH again
      }
    } else {
      console.log("No previous chat histories found. Starting a new chat session.");
      // No need to delete CURRENT_SESSION_FILE_PATH again
    }
  }

  while (true) {
    const userPrompt = prompt("You: ");

    if (userPrompt === null || userPrompt.toLowerCase() === "exit") {
      console.log("Exiting chat.");
      break;
    }

    const fullPrompt =
      SYSTEM_PROMPT + currentChatHistory + `--- PROMPT ---\n${userPrompt}\n--- RESPONSE ---\n`;

    try {
      const { text: aiResponse } = await generateText({
        model: google(`models/${MODEL}`),
        prompt: fullPrompt,
        maxOutputTokens: TOKENOUT,
        temperature: TEMP,
      });

      console.log(`\nAI: ${aiResponse}`);

      if (JOKEBOT_MODE) {
        await saveChatSession(userPrompt, aiResponse, JOKEBOT_HISTORY_FILE_PATH);
      } else {
        await saveChatSession(userPrompt, aiResponse, CURRENT_SESSION_FILE_PATH);
      }
      currentChatHistory += `--- PROMPT ---\n${userPrompt}\n--- RESPONSE ---\n${aiResponse}\n\n`; // Update in-memory history
    } catch (error) {
      console.error(`Error generating response: ${error.message}`);
      // Decide if you want to break or continue on error
      break;
    }

    const continueChat = confirm("Do you want to continue the chat? (Y/n)");
    if (!continueChat) {
      console.log("Ending chat session.");
      if (!JOKEBOT_MODE) {
        const saveHistory = confirm("Do you want to save this chat history? (Y/n)");
        if (saveHistory) {
          try {
            const timestampedFilename = getTimestampedFilename();
            const newPath = HISTORY_DIR + timestampedFilename;
            // Deno.rename requires --allow-write permission
            await Deno.rename(CURRENT_SESSION_FILE_PATH, newPath);
            console.log(`Chat history saved as '${newPath}'.`);
          } catch (error) {
            console.error(`Failed to archive chat history: ${error.message}`);
          }
        } else {
          await deleteCurrentChatSession();
        }
      }
      // In Jokebot mode, history is continuously saved to jokebot_history.txt,
      // so no specific archiving/deletion is needed on exit.
      break;
    }
  }
}

// Run the main chat function
main();
