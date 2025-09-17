# VisionPair: The AI-Powered Voice Navigator

**Navigate the web with the power of your voice. VisionPair is an intelligent browser extension that provides a conversational interface to the internet, specifically designed for visually impaired users.**

## About The Project

The modern web is overwhelmingly visual, creating significant barriers for users with visual impairments. Traditional screen readers are powerful but can be linear and cumbersome on complex, dynamic websites.

Aura bridges this gap by acting as an AI co-pilot. It uses advanced Large Language Models (LLMs) to understand what you want to do, interacts with the website on your behalf, and tells you what happened in a clear, natural voice. It turns the task of navigating a cluttered webpage into a simple conversation.

## Key Features

- **Voice-First Navigation:** Control your browser entirely through natural language commands.
    
- **Intelligent Actions:** Understands context. You can say "find the search bar" or "add this to my cart" instead of tabbing through dozens of elements.
    
- **On-Demand Summarization:** Ask Aura to summarize a long article, describe the images on a page, or list the main headlines.
    
- **Reliable Control:** Translates your intent into deterministic DOM actions, ensuring that commands work predictably.
    
- **Real-time Audio Feedback:** Provides instant, conversational feedback for every action you take.
    

## How It Works

Aura operates on a simple yet powerful loop:

1. **Understand:** The user's voice command is captured and sent to an LLM to identify their specific **intent** (the operation) and **sentiment**.
    
2. **Act:** This intent is mapped to a **deterministic action** using the browser's DOM API (e.g., executing a click or finding an element) to ensure reliable execution.
    
3. **Parse:** The extension retrieves the result of this action from the web page, then **sanitizes and parses** it to extract only the clean, relevant data.
    
4. **Elaborate:** This clean data is sent **back to the LLM**, which generates a context-aware, natural language summary based on the retrieved information.
    
5. **Respond:** The LLM's helpful text response is converted to speech and played back to the user, completing the interaction.
    

## Getting Started

### For Users

The easiest way to get started is to install Aura from your browser's extension store.

- [Install for Google Chrome](https://www.google.com/search?q=link-to-chrome-store) (Coming Soon!)
    
- [Install for Mozilla Firefox](https://www.google.com/search?q=link-to-firefox-store) (Coming Soon!)
    

Once installed, pin the extension to your toolbar and grant it microphone permissions when prompted.

### For Developers

To get a local copy up and running for development and testing, follow these steps.

**Prerequisites:**

- Node.js (v18 or later)
    
- npm or yarn
    

**Installation:**

1. Clone the repository:
    
    Bash
    
    ```
    git clone https://github.com/your-username/aura.git
    ```
    
2. Navigate to the project directory:
    
    Bash
    
    ```
    cd visionpair
    ```
    
3. Install NPM packages:
    
    Bash
    
    ```
    npm install
    ```
    
4. Build the extension:
    
    Bash
    
    ```
    npm run build
    ```
    
5. Load the extension in your browser (e.g., in Chrome, go to `chrome://extensions`, enable "Developer mode", and "Load unpacked" the `dist` directory).
    

## Usage

Simply activate the extension (e.g., via a keyboard shortcut or by clicking its icon) and speak your command.

**Example Commands:**

- _"Read the main headlines on this page."_
    
- _"Find the search bar and type 'latest news from India'."_
    
- _"Click on the link about the monsoon season."_
    
- _"Summarize this article for me."_
    
- _"What are the items in my shopping cart?"_
    

## Technology Stack

- **Frontend:** JavaScript (ES6+), HTML5, CSS3
    
- **Browser API:** WebExtensions API
    
- **AI Services:**
    
    - **LLM:** OpenAI GPT API
        
    - **Speech-to-Text (STT):** Browser's built-in Web Speech API / Google Cloud Speech-to-Text
        
    - **Text-to-Speech (TTS):** Browser's built-in Web Speech API / Google Cloud Text-to-Speech
        
- **Build Tools:** Webpack, Babel
    

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

Please refer to the `CONTRIBUTING.md` file for our contribution guidelines.

## License

Distributed under the MIT License. See `LICENSE` for more information.
