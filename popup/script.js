window.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const recordingStatus = document.getElementById("recordingStatus");

  // MediaRecorder variables
  let mediaRecorder;
  let audioChunks = [];

  // Perform Search in the current tab or a new tab
  function performSearch(query, tab) {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
      query
    )}`;
    if (tab && tab.id) {
      browser.tabs.update(tab.id, { url: searchUrl }).catch((err) => {
        console.error("Failed to update requesting tab for search:", err);
        // fallback: create a new tab with the search
        browser.tabs.create({ url: searchUrl });
      });
      return;
    }

    browser.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          return browser.tabs.update(tabs[0].id, { url: searchUrl });
        }
        return browser.tabs.create({ url: searchUrl });
      })
      .catch((err) => {
        console.error(
          "Error finding active tab for search, creating new tab instead:",
          err
        );
        browser.tabs.create({ url: searchUrl });
      });
  }

  // -----------------------------------------------------------------------------
  // Helper: send a message to the active tab (supports browser and chrome APIs)
  /**
   * Sends a message to the content script of the active tab.
   * @param {object} message The message payload to send.
   */
  function sendToActiveTab(message) {
    // Use the global 'browser' object for Firefox extensions.
    document.getElementById("STT").innerText = JSON.stringify(message.value);

    browser.runtime.sendMessage({ action: "setVar", key: "lastCommand", value: message }).catch((err) => {
      console.error("Error setting lastCommand in storage:", err);
    });


    const api = browser;

    if (!api || !api.tabs) {
      console.error(
        "tabs API not available. This code must run in an extension context."
      );
      return;
    }

    // Use the modern promise-based API.
    // This is the correct and standard way for Firefox.
    api.tabs
      .query({ active: true, currentWindow: true })
      .then((tabs) => {
        // Check if an active tab was found.
        if (!tabs || tabs.length === 0) {
          console.warn("No active tab found to send message to.");
          return;
        }
        console.log(browser.tabs);

        if (message.key === "search") {
          performSearch(message.value, tabs[0]);
          return;
        }
        // Send the message to the first tab in the array (the active tab).
        else return browser.tabs.sendMessage(tabs[0].id, message);
      })
      .then((response) => {
        // This block runs if the content script sent a response back.
        if (response) {
          console.log("Message sent successfully. Response:", response);
        }
      });
  }

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
    if (event.code === "Space" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();

      if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        recordingStatus.textContent = "Stopping recording...";
      } else {
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
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });

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
              sendToActiveTab(result);
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

  // Add handler to open mic permission page in a new tab
  (() => {
    const btn = document.getElementById("getPerms");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const url =
        typeof browser !== "undefined" &&
        browser.runtime &&
        browser.runtime.getURL
          ? browser.runtime.getURL("popup/mic_perms.html")
          : "mic_perms.html";
      // open in a new tab (popup UI can't directly trigger the browser permission prompt reliably)
      window.open(url, "_blank");
    });
  })();
});
