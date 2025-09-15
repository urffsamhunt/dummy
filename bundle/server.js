// Import necessary modules
const express = require("express");
const multer = require("multer");
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.5-flash-lite";
const MODEL2_NAME = "gemini-2.5-flash-preview-tts";

const app = express();
app.use(cors());
app.use(express.json());

// Using memory storage to handle the file as a buffer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialize Google Generative AI Client
if (!API_KEY) {
  throw new Error(
    "GEMINI_API_KEY is not defined in the environment variables."
  );
}
const genAI = new GoogleGenerativeAI(API_KEY);

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
];

// --- API Endpoints ---

/**
 * 1. Audio Analysis Endpoint
 * This endpoint accepts an audio file, analyzes it based on a system prompt,
 * and returns a structured JSON output.
 * * Route: POST /analyze-audio
 * Content-Type: multipart/form-data
 * Form Fields:
 * - 'audio': The audio file to be analyzed.
 * - 'prompt' (optional): A text prompt to guide the analysis.
 */
app.post("/analyze-audio", upload.single("audio"), async (req, res) => {
  console.log("Received request for /analyze-audio");

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file uploaded." });
    }

    // A system instruction for sentiment analysis and modelling
    const systemInstruction = {
      parts: [
        {
          text: "You are an expert audio analyst and browsing assistant. Your task is to analyze the user's web browsing query and classify it into certain enumerated procedures. The enums are : search, back, forward, summarize. The response should be a JSON object with the key being the procedure name and result being the value.",
        },
      ],
      role: "model",
    };

    // Define the JSON schema for the desired output format
    // The generation config with the new JSON schema.
    const generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          key: {
            type: "STRING",
            enum: ["search", "back", "forward", "summarize"],
            description: "The classified browsing command from the audio.",
          },
          value: {
            type: "STRING",
            description: "The query or target for the procedure",
          },
        },
        required: ["key", "value"],
      },
    };

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction,
      safetySettings,
      generationConfig,
    });

    const audio_parts = [
      {
        inlineData: {
          mimeType: req.file.mimetype,
          data: req.file.buffer.toString("base64"),
        },
      },
    ];

    const userPrompt =
      req.body.prompt || "Please analyze this customer service call audio.";

    const result = await model.generateContent([userPrompt, ...audio_parts]);
    const response = result.response;

    const jsonResponse = JSON.parse(response.text());

    console.log("Successfully analyzed audio. Sending response.");
    res.status(200).json(jsonResponse);
  } catch (error) {
    console.error("Error in /analyze-audio:", error);
    res
      .status(500)
      .json({ error: "Failed to process audio.", details: error.message });
  }
});

/**
 * 2. Text-to-JSON Generation Endpoint
 * This endpoint accepts a text prompt and returns a structured JSON object
 * based on a predefined schema.
 * * Route: POST /generate-json
 * Content-Type: application/json
 * Body: { "prompt": "Your text prompt here" }
 */

app.post("/generate-json", async (req, res) => {
  console.log("Received request for /generate-json");

  try {
    const { prompt, html } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Text prompt is required." });
    }

    // System instruction guiding the JSON extraction for UI elements.
    const systemInstruction = {
      parts: [
        {
          // Tell the model how to populate the JSON fields and how to use the prompt/raw HTML
          text: `You are a web UI extractor. The incoming 'prompt' is the original user's question and must be used when deciding which elements are relevant. Parse the provided raw HTML and identify up to N UI elements relevant to the user's question. For each element return an object with 'type' (button|link|text|input), a concise one-line 'description', and place any selector or locator helpful for programmatic interaction into 'additionalInfo'. For inputs and buttons, always include a CSS query selector or other short selector string in additionalInfo that can be used to locate the element (e.g. "#id", ".class", "input[name=foo]", or a short combination). If no reliable selector exists, include a short heuristic (e.g. "text contains 'Subscribe'").

For normal summary-style output, you may use index '0' in the JSON format to return a textual summary of the page; other indices should map to elements. Use the 'html' payload to parse and extract information; do not invent selectors that are impossible. Keep descriptions and additionalInfo concise and machine-usable.`,
        },
      ],
      role: "system",
    };

    const generationConfig = {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        description: "Mapping of indices 0..14 to UI elements.",
        properties: Object.fromEntries(
          Array.from({ length: 7 }, (_, i) => [
            String(i),
            {
              type: "OBJECT",
              properties: {
                type: {
                  type: "STRING",
                  enum: ["button", "link", "text", "input"],
                  description: "The type of element.",
                },
                description: {
                  type: "STRING",
                  description: "Short and concise description.",
                },
                additionalInfo: {
                  type: "STRING",
                  description: "Optional extra info.",
                },
              },
              required: ["type", "description"],
            },
          ])
        ),
      },
    };

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings,
      systemInstruction,
      generationConfig,
    });

    const result = await model.generateContent(
      prompt + "html code" + "\n\n\n" + html
    );
    const response = result.response;

    let jsonResponse = JSON.parse(response.text());

    // Extra safeguard: trim to 15 entries
    const keys = Object.keys(jsonResponse);
    if (keys.length > 15) {
      jsonResponse = Object.fromEntries(
        keys.slice(0, 15).map((k) => [k, jsonResponse[k]])
      );
    }

    console.log("Successfully generated indexed JSON. Sending response.");
    res.status(200).json(jsonResponse);
  } catch (error) {
    console.error("Error in /generate-json:", error);
    res
      .status(500)
      .json({ error: "Failed to generate JSON.", details: error.message });
  }
});

/**
 * 3. JSON-to-text-to-speech Generation Endpoint
 * This endpoint accepts a JSON with prompt and returns a readable format text
 * which is then converted to speech.
 * * Route: POST /generate-JSON-speech
 * Content-Type: .wav
 * Body: { "prompt": "Your text prompt here" }
 */

const fs = require("fs");
const path = require("path");
const wav = require("wav");

// Function to save WAV file from PCM data buffer
async function saveWaveFile(
  filename,
  pcmData,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
) {
  return new Promise((resolve, reject) => {
    const filePath = path.resolve(__dirname, filename);
    const writer = new wav.FileWriter(filePath, {
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    writer.on("finish", () => resolve(filePath));
    writer.on("error", reject);

    writer.write(pcmData);
    writer.end();
  });
}

app.post("/generate-JSON-speech", async (req, res) => {
  try {
    const { jsonData } = req.body;
    if (!jsonData) {
      return res.status(400).json({ error: "JSON data is required." });
    }

    // Prepare prompt wrapped as contents as expected by GoogleGenAI API
    const promptContent = {
      text: `You are an assistant that converts structured JSON data into a natural, human-readable description.
Please read the following JSON as a normal person would:
${JSON.stringify(jsonData, null, 2)}`,
    };

    // Step 1: Generate natural language text from JSON
    const transcriptModel = genAI.getGenerativeModel({
      model: MODEL_NAME,
      safetySettings,
    });
    const transcriptResult = await transcriptModel.generateContent(
      promptContent.text
    );
    const transcriptText = transcriptResult.response.text();

    // // Step 2: Generate TTS audio from the natural text

    const ttsConfig = {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Zephyr" },
        },
      },
    };
    const ttsModel = genAI.getGenerativeModel({
      model: MODEL2_NAME,
      generationConfig: ttsConfig,
    });

    console.log("Generating speech for text:", transcriptText);

    const ttsResult = await ttsModel.generateContent(transcriptText);

    const base64Audio =
      ttsResult.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return res
        .status(500)
        .json({ error: "No audio data received from TTS model." });
    }

    const audioBuffer = Buffer.from(base64Audio, "base64");

    // Respond with the audio bytes directly so clients can play it
    res.set({
      "Content-Type": "audio/wav",
      "Content-Length": audioBuffer.length,
      "Content-Disposition": 'inline; filename="speech.wav"',
    });

    const fileName = "out.wav";
    await saveWaveFile(fileName, audioBuffer);
    return res.status(200).send(audioBuffer);
  } catch (error) {
    console.error("Error in /generate-JSON-speech:", error);
    res.status(500).json({
      error: "Failed to generate or return speech.",
      details: error.message,
    });
  }
});

/**
 * 4. text-to-speech Generation Endpoint
 * This endpoint accepts a text
 * Which is then converted to speech.
 * * Route: POST /generate-speech
 * Content-Type: .wav
 */

app.post("/generate-tts", async (req, res) => {
  try {
    const textToSpeak =
      req.body.text || "Say cheerfully: Have a wonderful day!";

    // Use the existing genAI client to produce audio directly (no disk writes)
    const ttsModel = genAI.getGenerativeModel({
      model: MODEL2_NAME,
      safetySettings,
      generationConfig: { responseMimeType: "audio/wav" },
    });

    const ttsConfig = {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
      },
    };

    const ttsResult = await ttsModel.generateContent(
      [
        {
          parts: [{ text: textToSpeak }],
        },
      ],
      { config: ttsConfig }
    );

    // The audio data is returned as a stream of Base64 encoded chunks.
    const data = ttsResult.stream.getReader();
    const allChunks = [];

    // The stream is asynchronous, so you need to read it chunk by chunk.
    while (true) {
      const { value, done } = await data.read();
      if (done) {
        break;
      }
      allChunks.push(value);
    }

    // Concatenate the chunks into a single buffer.
    const audioBuffer = Buffer.concat(allChunks);

    if (!audioBuffer || audioBuffer.length === 0) {
      return res
        .status(500)
        .json({ error: "No audio data returned from model." });
    }

    // Set the correct headers and send the audio file.
    res.set({
      "Content-Type": "audio/wav",
      "Content-Length": audioBuffer.length,
      "Content-Disposition": 'inline; filename="speech.wav"',
    });
    return res.status(200).send(audioBuffer);
  } catch (error) {
    console.error("Error in /generate-tts:", error);
    res
      .status(500)
      .json({ error: "Failed to generate audio.", details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
