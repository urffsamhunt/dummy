window.addEventListener("DOMContentLoaded", () => {

  // DOM Elements
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
    // Backend Endpoint URL
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

  // --- Event Listener for Ctrl+B to start recording or stop recording ---
  document.addEventListener("keydown", async (event) => {
    if (event.code === "KeyB" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();

      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        recordingStatus.textContent = "Stopping recording...";
      }
      else {

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

        try {
          // Request access to the user's microphone
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

          // Initialize MediaRecorder
          mediaRecorder = new MediaRecorder(stream);
          audioChunks = [];

          mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
          };

          mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
            const audioFile = new File([audioBlob], "recording.webm", {
              type: "audio/webm",
            });

            audioChunks = [];

            try {
              recordingStatus.textContent = "Analyzing audio...";
              console.log("Recording stopped. Sending audio to backend...");

              const result = await analyzeAudio(audioFile);

              console.log("--- Gemini Analysis Result ---");
              console.log(result);
              console.log("------------------------------");

              recordingStatus.textContent =
                "Analysis complete. Output is in the console.";
            } catch (error) {
              console.error("Failed to get analysis from backend:", error);
              recordingStatus.textContent = `Analysis failed: ${error.message}`;
            }
          };

          mediaRecorder.start();

          // Update UI to reflect recording state
          recordingStatus.textContent = "Recording...";

        } catch (err) {
          console.error("Error accessing microphone:", err);
          recordingStatus.textContent = "Error: Could not access microphone.";
        }
      }
    }
  });

});