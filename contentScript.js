// Listens for messages from the background script.
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handles the request for SANITIZED HTML from the background script.
    if (message.action === "getSanitizedPageHtml") {
        console.log("Background script requested sanitized HTML. Sanitizing and Sending it now.");
        const sanitizedHtml = parseAndSanitizePage(document.body);
        sendResponse({ html: sanitizedHtml });
        return true; // Required for asynchronous response.
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

/*
function parseAndSanitize(dom) {
  // Select all <a> elements that have an <h3> as a direct child
  const nodes = dom.querySelectorAll('a:has(> h3)');

  let htmlString = '';
  nodes.forEach(node => {
    htmlString += node.outerHTML;
  });

  return htmlString; // optionally return the concatenated HTML string
}
*/ 

/**
 * Sanitizes the page's body to create a clean, simple HTML string for the AI.
 * This focuses on interactive elements and text content, removing clutter.
 * @param {HTMLElement} body - The document.body element.
 * @returns {string} - A simplified HTML string representing the page content.
 */
function parseAndSanitizePage(body) {
    if (!body) return "";
    
    // Create a clone of the body to avoid modifying the actual page.
    const clone = body.cloneNode(true);

    // Remove tags that are usually irrelevant for navigation and clutter the context.
    const tagsToRemove = ['script', 'style', 'noscript', 'iframe', 'svg', 'header', 'footer', 'nav', 'img', 'link', 'meta'];
    clone.querySelectorAll(tagsToRemove.join(',')).forEach(el => el.remove());
    
    // Remove hidden elements
    clone.querySelectorAll('[style*="display: none"], [hidden]').forEach(el => el.remove());

    // Reduce long text to avoid exceeding token limits
    clone.querySelectorAll('p, div, span').forEach(el => {
        if (el.textContent.length > 200) {
            el.textContent = el.textContent.substring(0, 200) + '...';
        }
    });

    // Return the cleaned HTML as a string
    return clone.innerHTML.replace(/\s{2,}/g, ' ').trim(); // Collapse whitespace
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
    // Find the best match, preferring exact matches
    let bestMatch = null;
    for (const el of Array.from(candidates)) {
        const elText = el.textContent.trim().toLowerCase();
        if (elText === lowerCaseText) return el; // Exact match found
        if (elText.includes(lowerCaseText)) bestMatch = el; // Partial match
    }
    return bestMatch;
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
    // Fallback for inputs without labels
    return document.querySelector(`[aria-label*="${labelText}" i], [placeholder*="${labelText}" i]`);
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