// Listens for messages from the background script.
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Executing command:", command);
    // Handles the request for HTML from the background script.
    if (message.action === "getPageHtml") {
        console.log("Background script requested HTML. Sending it now.");
        sendResponse({ html: document });
        parseAndSanitize(document);
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


function parseAndSanitize(dom) {
  // Select all <a> elements that have an <h3> as a direct child
  const nodes = dom.querySelectorAll('a:has(> h3)');

  let htmlString = '';
  nodes.forEach(node => {
    htmlString += node.outerHTML;
  });

  return htmlString; // optionally return the concatenated HTML string
}

//Procedure S
function executeCommand(command) {
    console.log("Executing command:", command);
    const { key, value } = command;
    switch (key) {
        case 'click': handleClick(value); break;
        case 'hover': handleHover(value); break;
        case 'input': handleInput(value[0], value[1]); break;
        case 'back': handleBack(value); break;
        case 'forward': handleForward(value); break;
        case 'search': handleSearch(value); break;
        case 'bookmark': handleBookmark(); break;
        default: console.error(`Unknown command key: "${key}"`);
    }
}

// --- Helper Functions to Find Elements on the Page ---
function findElementByText(text) {
    if (!text) return null;
    const lowerCaseText = text.trim().toLowerCase();
    const candidates = document.querySelectorAll('a, button, [role="button"], [role="link"], input[type="submit"]');
    return Array.from(candidates).find(el => el.textContent.trim().toLowerCase().includes(lowerCaseText));
}

function findElementForInput(labelText) {
    if (!labelText) return null;
    const lowerCaseLabel = labelText.trim().toLowerCase();
    for (const label of document.querySelectorAll('label')) {
        if (label.textContent.trim().toLowerCase().includes(lowerCaseLabel)) {
            const inputId = label.getAttribute('for');
            if (inputId) return document.getElementById(inputId);
            return label.querySelector('input, textarea, select');
        }
    }
    return null;
}

//Procedure Execution
function handleClick(queryParams) {
    const element = findElementByText(queryParams.text);
    if (element) element.click();
    else console.error(`Could not find element to click with text: "${queryParams.text}"`);
}

function handleHover(queryParams) {
    const element = findElementByText(queryParams.text);
    if (element) element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    else console.error(`Could not find element to hover with text: "${queryParams.text}"`);
}

function handleInput(inputValue, queryParams) {
    const inputElement = findElementForInput(queryParams.text);
    if (inputElement) {
        inputElement.value = inputValue;
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        inputElement.dispatchEvent(new Event('change', { bubbles: true }));
    } else console.error(`Could not find input field with label: "${queryParams.text}"`);
}

function handleBack(pages) { history.go(-pages); }
function handleForward(pages) { history.go(pages); }

function handleSearch(searchText) {
    // The content script can't create tabs, so it will ask the background script to do it.
    browser.runtime.sendMessage({ action: 'search', query: searchText });
}

function handleBookmark() {
    // The Content script can't create bookmarks, so it will ask the background script.
    browser.runtime.sendMessage({ action: 'addBookmark' });
}