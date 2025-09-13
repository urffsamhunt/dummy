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
const MODEL2_NAME = 'gemini-2.5-flash-preview-tts';

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
        const { prompt } = req.body;

        // Validate that a prompt was provided
        if (!prompt) {
            return res.status(400).json({ error: 'Text prompt is required.' });
        }

        // Define the JSON schema for the desired output format, to be fixed later
        const generationConfig = {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    recipeName: { type: "STRING", description: "The name of the recipe." },
                    ingredients: {
                        type: "ARRAY",
                        items: { type: "STRING" },
                        description: "A list of ingredients for the recipe."
                    },
                    servings: { type: "NUMBER", description: "The number of servings."}
                },
                required: ["recipeName", "ingredients"]
            },
        };
        
        const model = genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings, generationConfig });
        
        const result = await model.generateContent(prompt);
        const response = result.response;

        const jsonResponse = JSON.parse(response.text());

        console.log('Successfully generated JSON from text. Sending response.');
        res.status(200).json(jsonResponse);

    } catch (error) {
        console.error('Error in /generate-json:', error);
        res.status(500).json({ error: 'Failed to generate JSON.', details: error.message });
    }
});


/**
 * 3. JSON-to-text-to-speech Generation Endpoint
 * This endpoint accepts a JSON with prompt and returns a readable format text
 * which is then converted to speech.
 * * Route: POST /generate-speech
 * Content-Type: .wav
 * Body: { "prompt": "Your text prompt here" }
 */

const fs = require('fs');
const path = require('path');
const wav = require('wav');

// Function to save WAV file from PCM data buffer
async function saveWaveFile(filename, pcmData, channels = 1, rate = 24000, sampleWidth = 2) {
  return new Promise((resolve, reject) => {
    const filePath = path.resolve(__dirname, filename);
    const writer = new wav.FileWriter(filePath, {
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    writer.on('finish', () => resolve(filePath));
    writer.on('error', reject);

    writer.write(pcmData);
    writer.end();
  });
}

app.post('/generate-speech', async (req, res) => {
  try {
    const { jsonData } = req.body;
    if (!jsonData) {
      return res.status(400).json({ error: 'JSON data is required.' });
    }

    const prompt = `You are an assistant that converts structured JSON data into a natural, human-readable description.
                    Please read the following JSON as a normal person would:
                    ${JSON.stringify(jsonData, null, 2)}`;

    // Step 1: Generate natural language text from JSON
    const transcriptResult = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      safetySettings,
    });
    const transcriptText = transcriptResult.response.text();

    // Step 2: Generate TTS audio from the natural text
    const ttsModel = genAI.getGenerativeModel({
      model: MODEL2_NAME,
      safetySettings,
      generationConfig: {
        responseMimeType: 'audio/wav',
      },
    });

    const ttsConfig = {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: 'Zephyr' },
        },
      },
    };

    const ttsResult = await ttsModel.generateContent(transcriptText, { config: ttsConfig });

    const base64Audio = ttsResult.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      return res.status(500).json({ error: 'No audio data received from TTS model.' });
    }

    const audioBuffer = Buffer.from(base64Audio, 'base64');

    // Save WAV file directly (assuming audioBuffer is WAV data)
    const outputFileName = 'output_audio.wav';
    const outputPath = path.resolve(__dirname, outputFileName);
    await fs.promises.writeFile(outputPath, audioBuffer);

    console.log(`Audio saved to ${outputPath}`);

    res.status(200).json({ message: 'Speech audio generated and saved.', file: outputFileName });
  } catch (error) {
    console.error('Error in /generate-speech:', error);
    res.status(500).json({ error: 'Failed to generate or save speech.', details: error.message });
  }
});



app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
