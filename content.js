
console.log("test");



browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handles the request for HTML from the background script.
    if (message.action === "getPageHtml") {
        console.log("Background script requested HTML. Sending it now.");
        sendResponse({ html: document.documentElement.outerHTML });
        return true; // Required for asynchronous responses.
    }

    // If the popup wrapped the backend result as { key: 'ai_result', value: result }
    // then execute the inner result as a command object.
    if (message.key === 'ai_result' && message.value) {
        console.log('Received AI result wrapper - executing inner command:', message.value);
        executeCommand(message.value);
        return;
    }

    // Handles the commands to be executed
    if (message.key) {
        console.log("Received AI command to execute:", message);
        executeCommand(message);
    }
});
