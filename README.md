# Gemini API Express Server

This project is a simple Node.js Express server that provides two API endpoints for interacting with the Google Gemini API.

## Endpoints

1. **`POST /analyze-audio`**: Accepts an audio file, analyzes it with a system prompt for context, and returns a structured JSON object containing the analysis (e.g., summary, sentiment, action items).
    
2. **`POST /generate-json`**: Accepts a text prompt and returns a structured JSON object based on the content of the prompt (e.g., extracting recipe details).
    

## Prerequisites

- Node.js (v18 or later recommended)
    
- npm (comes with Node.js)
    
- A Google Gemini API Key. You can get one from [Google AI Studio](https://aistudio.google.com/app/apikey "null").
    

## Setup and Installation

1. **Clone the repository or save the files:** Download `server.js` and `package.json` into a new project folder.
    
2. **Create a `.env` file:** In the root of your project directory, create a new file named `.env` and add your Gemini API key to it:
    
    ```
    GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"
    ```
    
3. **Install dependencies:** Open your terminal in the project directory and run:
    
    ```
    npm install
    ```
    
4. **Start the server:**
    
    ```
    npm start
    ```
    
    The server should now be running on `http://localhost:3000`.
    

## How to Test the Endpoints

You can use a tool like `curl` or Postman to test the endpoints.

### 1. Test `/analyze-audio`

Find an audio file on your computer (e.g., an `.mp3` or `.wav` file) and run the following `curl` command in your terminal, replacing `path/to/your/audio.mp3` with the actual path to your file.

```
curl -X POST http://localhost:3000/analyze-audio \
  -F "audio=@path/to/your/audio.mp3"
```

**Expected Response:**

You should receive a JSON object similar to this:

```
{
    "summary": "The customer is calling to report an issue with their recent order where they received the wrong item.",
    "sentiment": "negative",
    "action_items": [
        "Apologize to the customer for the inconvenience.",
        "Initiate a return for the incorrect item.",
        "Ship the correct item with expedited shipping."
    ]
}
```

### 2. Test `/generate-json`

Run the following `curl` command in your terminal. The System Prompts are not calibrated, make sure you fix it before testing, or the endpoint will output some other random format.

```
curl -X POST http://localhost:3000/generate-json \
  -H "Content-Type: application/json" \
  -d '{
        "prompt": "Create a simple recipe for chocolate chip cookies. It should make 24 cookies and include flour, sugar, butter, and chocolate chips."
      }'
```

**Expected Response:**

You should receive a random JSON object structured like this:

```
{
    "recipeName": "Simple Chocolate Chip Cookies",
    "ingredients": [
        "1 cup all-purpose flour",
        "1/2 cup granulated sugar",
        "1/2 cup unsalted butter, softened",
        "1 cup chocolate chips"
    ],
    "servings": 24
}
```