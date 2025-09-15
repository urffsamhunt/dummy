// browser.browserAction.onClicked.addListener(() => {
//   browser.tabs.create({
//     url: browser.runtime.getURL("popup/index_popup.html")
//   });
// });

// This listener triggers automatically whenever a tab finishes loading.
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // We only act when a page has completely loaded and has a web URL.
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.startsWith("http")
  ) {
    console.log(`Page loaded: ${tab.url}. Requesting HTML...`);

    let htmlText = browser.tabs
      .sendMessage(tabId, { action: "getPageHtml" })
      .then((response) => {
        if (response && response.html) {
          handleRawHtml(response.html);
        }
      })
      .catch((error) =>
        console.error(`Could not get HTML from content script: ${error}`)
      );
  }
});

//Take the captured HTML and log it.
async function handleRawHtml(rawHtml) {
  console.log("Successfully captured raw HTML content from the page:");

  // Persist the raw page snapshot (try to parse JSON, fall back to raw string)
  try {
    let parsed = rawHtml;
    try {
      parsed = JSON.parse(rawHtml);
    } catch (e) {
      /* not JSON, keep raw string */
    }
    await browser.storage.local.set({ pageHtml: parsed });
    console.log("Persisted page HTML to storage.");
  } catch (err) {
    console.error("Error storing page HTML:", err);
  }

  console.log(rawHtml);

  // Read lastCommand from storage and use it as the prompt to call the generate-json API
  try {
    const res = await browser.storage.local.get("lastCommand");
    const lastCommand = res && res.lastCommand ? res.lastCommand : "";

    // Prepare payload
    const payload = { prompt: lastCommand, html: rawHtml };

    console.log("Calling /generate-json with prompt:", lastCommand);

    const response = await fetch("http://localhost:3000/generate-json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`generate-json returned ${response.status}: ${txt}`);
    }

    const jsonResp = await response.json();
    console.log("Received generate-json response:", jsonResp);

    // Persist the generated JSON for later retrieval
    try {
      await browser.storage.local.set({ lastGeneratedJson: jsonResp });
      console.log(
        "Persisted generate-json result to storage as lastGeneratedJson"
      );
    } catch (err) {
      console.error("Error storing generated JSON:", err);
    }

    // --- New: request speech audio for the generated JSON and persist it ---
    try {
      const ttsResp = await fetch("http://localhost:3000/generate-JSON-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonData: jsonResp }),
      });

      if (!ttsResp.ok) {
        const txt = await ttsResp.text();
        console.error(
          "generate-JSON-speech returned error:",
          ttsResp.status,
          txt
        );
      } else {
        const contentType = ttsResp.headers.get("content-type") || "";
        if (contentType.startsWith("audio/")) {
          const audioBlob = await ttsResp.blob();

          // Build a data URL and ask the active tab to play the audio (do not persist to storage)
          try {
            const audioUrl = URL.createObjectURL(audioBlob);
            await sendPlayAudio(audioUrl, contentType);
            console.log('Sent generated audio URL to active tab for playback');

            URL.revokeObjectURL(audioUrl);
          } catch (e) {
            console.warn('sendPlayAudio failed:', e);
          }
        } else {
          // Server returned non-audio (likely JSON error); log for debugging
          const txt = await ttsResp.text();
          console.warn("generate-JSON-speech did not return audio, response:", txt);
        }
      }
    } catch (err) {
      console.error("Error calling generate-JSON-speech:", err);
    }
  } catch (err) {
    console.error("Error during generate-json call:", err);
  }
}

// helper to ask the active tab to play base64 audio
async function sendPlayAudio(audioUrl, mime) {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs[0] || !tabs[0].id) {
      console.warn('No active tab available to play audio');
      return;
    }
    const tabId = tabs[0].id;
    // sendMessage to content script; it will create an audio blob and play
    browser.tabs.sendMessage(tabId, { action: 'playAudio', audioUrl, mime }).catch(err => {
      console.warn('Failed to send playAudio message to tab:', err);
    });
  } catch (err) {
    console.warn('sendPlayAudio error:', err);
  }
}

//handling actions requested by the Content Script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "search") {
    performSearch(message.query, sender && sender.tab);
    return; // no async response
  } else if (message.action === "addBookmark") {
    addBookmark(sender.tab);
    return;
  }

  // Persist small variables across page changes using storage.local
  // message: { action: 'setVar', key: 'myKey', value: any }
  if (message.action === "setVar") {
    console.log("Setting variable in storage:", message.key, message.value);
    const kv = {};
    kv[message.key] = message.value;
    browser.storage.local
      .set(kv)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // indicate async response
  }

  // message: { action: 'getVar', key: 'myKey' }
  if (message.action === "getVar") {
    browser.storage.local
      .get(message.key)
      .then((result) =>
        sendResponse({
          ok: true,
          value: result ? result[message.key] : undefined,
        })
      )
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  // message: { action: 'clearVar', key?: 'myKey' } - if key omitted, clear all
  if (message.action === "clearVar") {
    if (message.key) {
      browser.storage.local
        .remove(message.key)
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
    } else {
      browser.storage.local
        .clear()
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
    }
    return true;
  }
});

function performSearch(query, tab) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    query
  )}`;

  // If we have the originating tab, update it in-place to perform the search there.
  if (tab && tab.id) {
    browser.tabs.update(tab.id, { url: searchUrl }).catch((err) => {
      console.error("Failed to update requesting tab for search:", err);
      // fallback: create a new tab with the search
      browser.tabs.create({ url: searchUrl });
    });
    return;
  }

  // No originating tab provided: try to update the active tab, otherwise create a new tab.
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

function addBookmark(tab) {
  if (tab && tab.url) {
    browser.bookmarks.create({
      title: tab.title || "New Bookmark",
      url: tab.url,
    });
  }
}
