// Import necessary modules
const express = require('express');
const multer = require('multer');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'gemini-2.5-flash-lite'; 

const app = express();
app.use(cors());
app.use(express.json());

// Using memory storage to handle the file as a buffer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Initialize Google Generative AI Client
if (!API_KEY) {
  throw new Error("GEMINI_API_KEY is not defined in the environment variables.");
}
const genAI = new GoogleGenerativeAI(API_KEY);

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE },
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
app.post('/analyze-audio', upload.single('audio'), async (req, res) => {
  console.log('Received request for /analyze-audio');

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded.' });
    }

    // A system instruction for sentiment analysis and modelling
    const systemInstruction = {
      parts: [{ text: "You are an expert audio analyst and browsing assistant. Your task is to analyze the user's web browsing query and classify it into certain enumerated procedures. The enums are : search, back, forward, summarize. The response should be a JSON object with the key being the procedure name and result being the value." }],
      role: "model"
    };

    // Define the JSON schema for the desired output format
    // The generation config with the new JSON schema.
  const generationConfig = {
    responseMimeType: "application/json",
    responseSchema: {
      type: "OBJECT",
      properties: {
        procedure: {
          type: "STRING",
          enum: ["search", "back", "forward", "summarize"],
          description: "The classified browsing command from the audio.",
        },
        value: {
          type: "STRING",
          description: "The query or target for the procedure (e.g., the search term). Can be empty for commands like 'back' or 'forward'.",
        },
      },
      required: ["procedure"],
    },
  };

    const model = genAI.getGenerativeModel({ model: MODEL_NAME, systemInstruction, safetySettings, generationConfig });
    
    const audio_parts = [
        {
            inlineData: {
                mimeType: req.file.mimetype,
                data: req.file.buffer.toString("base64"),
            },
        },
    ];

    const userPrompt = req.body.prompt || "Please analyze this customer service call audio.";

    const result = await model.generateContent([userPrompt, ...audio_parts]);
    const response = result.response;
    
    const jsonResponse = JSON.parse(response.text());
    
    console.log('Successfully analyzed audio. Sending response.');
    res.status(200).json(jsonResponse);

  } catch (error) {
    console.error('Error in /analyze-audio:', error);
    res.status(500).json({ error: 'Failed to process audio.', details: error.message });
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

app.post('/generate-json', async (req, res) => {
    console.log('Received request for /generate-json');

    try {
        const { prompt, html } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Text prompt is required.' });
        }

     
        const generationConfig = {
  responseMimeType: "application/json",
  responseSchema: {
    type: "OBJECT",
    description: "Mapping of indices 0..14 to UI elements.",
    properties: Object.fromEntries(
      Array.from({ length: 15 }, (_, i) => [
        String(i),
        {
          type: "OBJECT",
          properties: {
            type: {
              type: "STRING",
              enum: ["button", "link", "text", "input"],
              description: "The type of element."
            },
            description: {
              type: "STRING",
              description: "Short and concise description."
            },
            additionalInfo: {
              type: "STRING",
              description: "Optional extra info."
            }
          },
          required: ["type", "description"]
        }
      ])
    )
  }
};




        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            safetySettings,
            generationConfig
        });

        const result = await model.generateContent(prompt + "html code" + "\n\n\n" + html);
        const response = result.response;

        let jsonResponse = JSON.parse(response.text());

        // Extra safeguard: trim to 15 entries
        const keys = Object.keys(jsonResponse);
        if (keys.length > 15) {
            jsonResponse = Object.fromEntries(
                keys.slice(0, 15).map(k => [k, jsonResponse[k]])
            );
        }

        console.log('Successfully generated indexed JSON. Sending response.');
        res.status(200).json(jsonResponse);

    } catch (error) {
        console.error('Error in /generate-json:', error);
        res.status(500).json({ error: 'Failed to generate JSON.', details: error.message });
    }
}
);



app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
