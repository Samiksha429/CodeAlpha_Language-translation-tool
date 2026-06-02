import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

let aiInstance: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in Settings > Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Translate endpoint
app.post("/api/translate", async (req, res) => {
  try {
    const { text, sourceLanguage, targetLanguage, tone = "Standard", dictionary = false } = req.body;

    if (!text || !text.trim()) {
      res.status(400).json({ error: "Text to translate is required" });
      return;
    }
    if (!targetLanguage) {
      res.status(400).json({ error: "Target language is required" });
      return;
    }

    const ai = getGeminiClient();

    const systemInstruction = `You are a professional language translation and linguistic expert.
Your job is to translate the source text to the target language with high accuracy, taking the specified tone into consideration.
If the source language is set to 'Auto Detect', you must first detect the actual input language.
You should provide the translation, detected language name, pronunciation guide, cultural/useful explanations, and a vocabulary word-by-word breakdown for key/difficult terms.
Maintain consistency, correct grammar, and capture natural idiomatic usage rather than word-for-word translation.`;

    const promptText = `Translate the following text.
Source Language: ${sourceLanguage || "Auto Detect"}
Target Language: ${targetLanguage}
Tone/Style preference: ${tone}
Text to translate:
"""
${text}
"""`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translatedText: {
              type: Type.STRING,
              description: "The complete translated text in the target language. Keep formatting if there are paragraph breaks."
            },
            detectedLanguage: {
              type: Type.STRING,
              description: "The actual source language detected (e.g. French, Spanish, Japanese, English). Only required if source language was Auto Detect, but always helpful."
            },
            pronunciation: {
              type: Type.STRING,
              description: "A phonetic guide or phonetic spelling of the translated text helper for beginners."
            },
            explanations: {
              type: Type.STRING,
              description: "Clear explanations of grammatical points, dialect nuances, idioms, or polite vs casual forms used."
            },
            vocabulary: {
              type: Type.ARRAY,
              description: "A list of key vocabulary words from the text.",
              items: {
                type: Type.OBJECT,
                properties: {
                  word: { type: Type.STRING, description: "Word or short phrase in source text" },
                  translation: { type: Type.STRING, description: "Translation of this specific word in target language" },
                  partOfSpeech: { type: Type.STRING, description: "Noun, Verb, Adjective, Idiom, Pronoun, etc." },
                  explanation: { type: Type.STRING, description: "A simple definition, conjugation info, or usage tip" }
                },
                required: ["word", "translation"]
              }
            }
          },
          required: ["translatedText", "detectedLanguage"]
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("No translation returned from Gemini API");
    }

    const payload = JSON.parse(resultText);
    res.json(payload);

  } catch (error: any) {
    console.error("API Error during translation:", error);
    res.status(500).json({
      error: error.message || "An unexpected error occurred during translation"
    });
  }
});

// Dictionary lookup endpoint (Single word / selective analyzer)
app.post("/api/dictionary", async (req, res) => {
  try {
    const { word, sourceLanguage, targetLanguage } = req.body;
    if (!word || !word.trim()) {
      res.status(400).json({ error: "Word is required for dictionary look up" });
      return;
    }

    const ai = getGeminiClient();
    const promptText = `Provide a detailed dictionary and lookup entry for the single word or short phrase "${word}" translating or referencing from source language "${sourceLanguage}" to target language "${targetLanguage}". Provide definition, direct translation, synonyms, part of speech, and 3 rich example sentences using it with translations.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            partOfSpeech: { type: Type.STRING },
            directTranslation: { type: Type.STRING },
            definition: { type: Type.STRING },
            synonyms: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            examples: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING, description: "Example sentence in source language" },
                  translation: { type: Type.STRING, description: "Translated example sentence in target language" }
                },
                required: ["original", "translation"]
              }
            }
          },
          required: ["word", "directTranslation", "definition", "examples"]
        }
      }
    });

    const resultText = response.text;
    res.json(JSON.parse(resultText || "{}"));
  } catch (error: any) {
    console.error("API Error during dictionary lookup:", error);
    res.status(500).json({ error: error.message || "An unexpected error occurred during lookup" });
  }
});

// Vite middleware integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
