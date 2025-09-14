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

// --- NEW AMBIGUITY HANDLING ENDPOINT ---

/**
 * Endpoint for Command Processing
 * This endpoint accepts a user's text prompt and the sanitized HTML of the current page.
 * It intelligently decides whether the command is clear, ambiguous but resolvable,
 * or ambiguous and requires a clarifying question for the user.
 * * Route: POST /process-command
 * Content-Type: application/json
 * Body: { "userPrompt": "text of user's command", "pageHtmlContext": "sanitized html string" }
 */
app.post('/process-command', async (req, res) => {
    console.log('Received request for /process-command');
    try {
        const { userPrompt, pageHtmlContext } = req.body;

        if (!userPrompt || !pageHtmlContext) {
            return res.status(400).json({ error: 'User prompt and page HTML context are required.' });
        }

        const generationConfig = {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    type: {
                        type: "STRING",
                        enum: ["action", "clarification"],
                    },
                    command: {
                        type: "OBJECT",
                        properties: {
                            key: {
                                type: "STRING",
                                enum: ["click", "hover", "input", "back", "forward", "search", "bookmark"],
                            },
                            value: {
                                type: "ANY" // Value can be a string, array, or object depending on the key
                            },
                        },
                    },
                    question: {
                        type: "STRING",
                    },
                },
                required: ["type"],
            },
        };
        
        const model = genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings, generationConfig });
        
        // This is the core prompt that instructs the AI on how to handle ambiguity.
        const instructionPrompt = `
You are an AI assistant for a browser extension for visually impaired users. Your goal is to translate a user's voice command into a precise action or, if the command is ambiguous, a clarifying question. You will be given the user's command and the sanitized HTML of the current webpage.

Analyze the user's command based on the provided HTML context and respond in one of two JSON formats:

1.  If the command is clear OR if it is ambiguous but you can resolve it using the HTML context (e.g., user says "click the first video" and you can identify it), respond with an "action" object.
    - For actions like 'click', 'hover', or 'input', use the exact text from the HTML element as the target.
    - The format is: {"type": "action", "command": {"key": "...", "value": ...}}
    
    Examples:
    - User says: "search for funny cat videos" -> {"type": "action", "command": {"key": "search", "value": "funny cat videos"}}
    - User says: "click on the contact us button" -> {"type": "action", "command": {"key": "click", "value": {"text": "Contact Us"}}}
    - User says: "type hello world into the username field" -> {"type": "action", "command": {"key": "input", "value": ["hello world", {"text": "username"}]}}

2.  If the command is ambiguous and you CANNOT resolve it with the given HTML (e.g., user says "click the link" and there are many links), you MUST ask a clarifying question. Do not try to guess.
    - The format is: {"type": "clarification", "question": "Your question to the user."}

    Example:
    - User says: "click the button" and the HTML contains "Login", "Sign Up", and "Learn More" buttons.
    - Your response: {"type": "clarification", "question": "I see a few buttons: Login, Sign Up, and Learn More. Which one would you like me to click?"}

---
USER COMMAND: "${userPrompt}"

PAGE HTML CONTEXT:
${pageHtmlContext}
---
        `;

        const result = await model.generateContent(instructionPrompt);
        const response = result.response;
        const jsonResponse = JSON.parse(response.text());

        console.log('Successfully processed command. Sending response:', jsonResponse);
        res.status(200).json(jsonResponse);

    } catch (error) {
        console.error('Error in /process-command:', error);
        res.status(500).json({ error: 'Failed to process command.', details: error.message });
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

app.post('/generate-JSON-speech', async (req, res) => {
  try {
    const { jsonData } = req.body;
    if (!jsonData) {
      return res.status(400).json({ error: 'JSON data is required.' });
    }

    // Prepare prompt wrapped as contents as expected by GoogleGenAI API
    const promptContent = [
      {
        parts: [
          {
            text: `You are an assistant that converts structured JSON data into a natural, human-readable description.
Please read the following JSON as a normal person would:
${JSON.stringify(jsonData, null, 2)}`
          }
        ]
      }
    ];

    // Step 1: Generate natural language text from JSON
    const transcriptResult = await genAI.models.generateContent({
      model: MODEL_NAME,
      contents: promptContent,
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

    const ttsResult = await ttsModel.generateContent(
      [
        {
          parts: [{ text: transcriptText }]
        }
      ],
      { config: ttsConfig }
    );

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
    console.error('Error in /generate-JSON-speech:', error);
    res.status(500).json({ error: 'Failed to generate or save speech.', details: error.message });
  }
});



/**
 * 4. text-to-speech Generation Endpoint
 * This endpoint accepts a text
 * Which is then converted to speech.
 * * Route: POST /generate-speech
 * Content-Type: .wav
 */

app.post('/generate-tts', async (req, res) => {
  try {
    const textToSpeak = req.body.text || 'Say cheerfully: Have a wonderful day!';

    const ai = new GoogleGenAI({});

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: textToSpeak }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!data) {
      return res.status(500).json({ error: 'No audio data returned from model.' });
    }

    const audioBuffer = Buffer.from(data, 'base64');

    const fileName = path.join(__dirname, 'out.wav');
    await saveWaveFile(fileName, audioBuffer);

    // Respond with success and path to saved WAV file
    res.status(200).json({ message: 'Audio generated successfully.', file: 'out.wav' });

  } catch (error) {
    console.error('Error in /generate-tts:', error);
    res.status(500).json({ error: 'Failed to generate audio.', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
