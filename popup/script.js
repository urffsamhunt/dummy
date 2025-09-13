window.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const recordButton = document.getElementById("recordButton");
  const stopButton = document.getElementById("stopButton");
  const recordingStatus = document.getElementById("recordingStatus");

  // MediaRecorder variables
  let mediaRecorder;
  let audioChunks = [];

  /**
   * Sends the audio file to the backend for analysis.
   * @param {File} audioFile The audio file to analyze.
   * @returns {Promise<object>} A promise that resolves with the JSON analysis result.
   */
  async function analyzeAudio(audioFile) {
    // The URL of your backend endpoint
    const apiUrl = "http://localhost:3000/analyze-audio";
    const formData = new FormData();
    formData.append("audio", audioFile);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || `HTTP error! status: ${response.status}`
        );
      }
      return await response.json();
    } catch (error) {
      // Log the detailed error and re-throw it to be handled by the caller
      console.error("Error calling the analyze-audio API:", error);
      throw error;
    }
  }

  // --- Event Listener for Record Button ---
  recordButton.addEventListener("click", async () => {
    try {
      // Request access to the user's microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Initialize MediaRecorder
      mediaRecorder = new MediaRecorder(stream);

      // This event fires when data is available to be collected
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      // This event fires when recording is stopped
      mediaRecorder.onstop = async () => {
        // Combine all collected audio chunks into a single Blob
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        // Create a File object to send to the backend
        const audioFile = new File([audioBlob], "recording.webm", {
          type: "audio/webm",
        });

        // Reset the chunks array for the next recording
        audioChunks = [];

        // --- Send to backend and log result ---
        try {
          // Update UI to show analysis is in progress
          recordingStatus.textContent = "Analyzing audio...";
          console.log("Recording stopped. Sending audio to backend...");

          // Call the API function
          const result = await analyzeAudio(audioFile);

          // Log the final result from the backend to the console
          console.log("--- Gemini Analysis Result ---");
          console.log(result);
          console.log("------------------------------");

          // Update UI to confirm completion
          recordingStatus.textContent =
            "Analysis complete. Output is in the console.";
        } catch (error) {
          console.error("Failed to get analysis from backend:", error);
          recordingStatus.textContent = `Analysis failed: ${error.message}`;
        }
      };

      // Start recording
      mediaRecorder.start();

      // Update UI to reflect recording state
      recordingStatus.textContent = "Recording...";
      recordButton.disabled = true;
      stopButton.disabled = false;
    } catch (err) {
      // Handle errors, like if the user denies microphone permission
      console.error("Error accessing microphone:", err);
      recordingStatus.textContent = "Error: Could not access microphone.";
    }
  });

  // --- Event Listener for Stop Button ---
  stopButton.addEventListener("click", () => {
    // Check if the mediaRecorder is active and recording
    if (mediaRecorder && mediaRecorder.state === "recording") {
      mediaRecorder.stop();

      // Update UI to reflect stopped state
      // The onstop event handler will update the status further.
      recordingStatus.textContent = "Stopping recording...";
      recordButton.disabled = false;
      stopButton.disabled = true;
    }
  });

  const svg = document.querySelector("#popup-content svg");
  if (!svg) return;

  svg.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(1.2)" },
      { transform: "scale(1)" },
    ],
    {
      duration: 3000,
      iterations: Infinity,
      easing: "linear",
    }
  );
});

function parseAndSanitize() {
  const input = document.getElementById("htmlInput").value;
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, "text/html");
  let bodyContent = doc.body.innerHTML;

  bodyContent = bodyContent
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?<\/embed>/gi, "")
    .replace(/<link[\s\S]*?>/gi, "")
    .replace(/<meta[\s\S]*?>/gi, "");

  document.getElementById("result").textContent = bodyContent;
}
