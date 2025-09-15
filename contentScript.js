// Listens for messages from the background script.
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Play base64 audio sent from background
  if (message.action === 'playAudio') {
    try {
      // If caller sent an audioUrl (data: or http(s):), play it directly
      if (message.audioUrl) {
        console.log('playAudio with URL:', message.audioUrl);
        const audio = new Audio(message.audioUrl);
        audio.play().catch((e) => console.warn('Audio play failed:', e));
        audio.onended = () => { /* nothing to revoke for data or remote URLs */ };
        sendResponse({ ok: true });
        return true;
      }

      // Fallback: legacy base64 payload
      if (message.audioBase64) {
        const mime = message.mime || 'audio/wav';
        const binary = atob(message.audioBase64);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes.buffer], { type: mime });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.play().catch((e) => console.warn('Audio play failed:', e));
        audio.onended = () => URL.revokeObjectURL(url);
        sendResponse({ ok: true });
        return true;
      }

      sendResponse({ ok: false, error: 'No audioUrl or audioBase64 provided' });
    } catch (e) {
      console.error('playAudio error:', e);
      sendResponse({ ok: false, error: String(e) });
    }
    return true; // async response
  }

  // Handles the request for HTML from the background script.
  if (message.action === "getPageHtml") {
    console.log("Background script requested HTML. Sending it now.");
    const htmlText = sanitizeAndSerializeDocument(document);
    sendResponse({ html: htmlText });
    // parseAndSanitize(document);
    return true; // Required for asynchronous responses.
  }

  if (message.key) {
    console.log("Received AI command to execute:", message);
    executeCommand(message);
  }
});

function parseAndSanitize(dom) {
  // Select all <a> elements that have an <h3> as a direct child
  const nodes = dom.querySelectorAll("a:has(> h3)");

  let htmlString = "";
  nodes.forEach((node) => {
    htmlString += node.outerHTML;
  });

  return htmlString; // optionally return the concatenated HTML string
}

function parseAndSanitizePage(dommy) {
  const nodes = dommy.querySelector(body);
  let htmlString = nodes.innerHTML;

  htmlString = htmlString
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?<\/object>/gi, "")
    .replace(/<embed[\s\S]*?<\/embed>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<g[\s\S]*?<\/g>/gi, "")
    .replace(/<path[\s\S]*?<\/path>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<link[\s\S]*?>/gi, "")
    .replace(/<meta[\s\S]*?>/gi, "");

  body.innerHTML = htmlString;
}

function resolveNavigation(command) {
  if (command.value == "") {
    return { key: command.key, value: 1 }; // Default to going back one page
  }
  return { key: command.key, value: parseInt(command.value) };
}

//Procedure S
function executeCommand(command) {
  console.log("Executing command:", command);
  // document.getElementById("STT").innerText = JSON.stringify(command.value);
  var { key, value } = command;

  if (key === "back" || key === "forward") {
    var { key, value } = resolveNavigation(command);
  }
  switch (key) {
    case "click":
      handleClick(value);
      break;
    case "hover":
      handleHover(value);
      break;
    case "input":
      handleInput(value[0], value[1]);
      break;
    case "back":
      handleBack(value);
      break;
    case "forward":
      handleForward(value);
      break;
    case "search":
      handleSearch(value);
      break;
    case "bookmark":
      handleBookmark();
      break;
    default:
      console.error(`Unknown command key: "${key}"`);
  }
}

// --- Helper Functions to Find Elements on the Page ---
function findElementByText(text) {
  if (!text) return null;
  const lowerCaseText = text.trim().toLowerCase();
  const candidates = document.querySelectorAll(
    'a, button, [role="button"], [role="link"], input[type="submit"]'
  );
  return Array.from(candidates).find((el) =>
    el.textContent.trim().toLowerCase().includes(lowerCaseText)
  );
}

function findElementForInput(labelText) {
  if (!labelText) return null;
  const lowerCaseLabel = labelText.trim().toLowerCase();
  for (const label of document.querySelectorAll("label")) {
    if (label.textContent.trim().toLowerCase().includes(lowerCaseLabel)) {
      const inputId = label.getAttribute("for");
      if (inputId) return document.getElementById(inputId);
      return label.querySelector("input, textarea, select");
    }
  }
  return null;
}

//Procedure Execution
function handleClick(queryParams) {
  const element = findElementByText(queryParams.text);
  if (element) element.click();
  else
    console.error(
      `Could not find element to click with text: "${queryParams.text}"`
    );
}

function handleHover(queryParams) {
  const element = findElementByText(queryParams.text);
  if (element)
    element.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  else
    console.error(
      `Could not find element to hover with text: "${queryParams.text}"`
    );
}

function handleInput(inputValue, queryParams) {
  const inputElement = findElementForInput(queryParams.text);
  if (inputElement) {
    inputElement.value = inputValue;
    inputElement.dispatchEvent(new Event("input", { bubbles: true }));
    inputElement.dispatchEvent(new Event("change", { bubbles: true }));
  } else
    console.error(
      `Could not find input field with label: "${queryParams.text}"`
    );
}

function handleBack(pages) {
  history.go(-pages);
}
function handleForward(pages) {
  history.go(pages);
}

function handleSearch(searchText) {
  // The content script can't create tabs, so it will ask the background script to do it.
  browser.runtime.sendMessage({ action: "search", query: searchText });
}

function handleBookmark() {
  // The Content script can't create bookmarks, so it will ask the background script.
  browser.runtime.sendMessage({ action: "addBookmark" });
}

// --------------------------------------------------------------------

function sanitizeAndSerializeDocument(doc = document, options = {}) {
  const { maxElements = 100, maxTextLen = 100, maxAttrLen = 100 } = options;

  // Prioritize interactable and descriptive elements
  // We will collect nodes in document order and merge consecutive text-like nodes
  const SELECTORS = [
    "button",
    "a",
    "input",
    "textarea",
    "select",
    "h1",
    "h2",
    "h3",
    "p",
    "span",
    "img",
    "label",
  ];
  const TEXT_TAGS = new Set(["p", "span", "h1", "h2", "h3"]);

  // Attributes that help identify or interact with elements
  const allowedAttrs = new Set([
    "id",
    "name",
    "class",
    "role",
    "type",
    "placeholder",
    "aria-label",
    "href",
    "src",
    "alt",
    "title",
  ]);

  function isVisible(el) {
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return false;
      return !!(
        el.offsetWidth ||
        el.offsetHeight ||
        el.getClientRects().length
      );
    } catch (e) {
      return false;
    }
  }

  function gatherAttributes(el) {
    const attrs = {};
    for (let i = 0; i < el.attributes.length; i++) {
      const a = el.attributes[i];
      if (!a || !a.name) continue;
      const name = a.name;
      if (allowedAttrs.has(name)) {
        let val = a.value || "";
        if (val.length > maxAttrLen) val = val.slice(0, maxAttrLen) + "…";
        attrs[name] = val;
      }
    }
    return attrs;
  }

  function extractText(el) {
    let txt = "";
    try {
      if (el.tagName === "IMG") {
        txt = el.alt || el.title || el.getAttribute("aria-label") || "";
      } else if (
        el.tagName === "INPUT" &&
        (el.type === "button" || el.type === "submit")
      ) {
        txt = el.value || el.title || el.getAttribute("aria-label") || "";
      } else {
        txt = el.innerText || el.textContent || "";
      }
    } catch (e) {
      txt = "";
    }
    txt = ("" + txt).replace(/\s+/g, " ").trim();
    if (txt.length > maxTextLen) txt = txt.slice(0, maxTextLen).trim() + "…";
    return txt;
  }

  const elements = [];
  try {
    // Collect all nodes matching selectors in document order
    const nodeList = Array.from(doc.querySelectorAll(SELECTORS.join(",")));
    let i = 0;
    while (i < nodeList.length && elements.length < maxElements) {
      const el = nodeList[i];
      i++;
      if (!isVisible(el)) continue;

      const tag = el.tagName.toLowerCase();

      // If this is a text-like element, merge it with following consecutive text-like elements
      if (TEXT_TAGS.has(tag)) {
        let combinedText = extractText(el);
        // merge following siblings in nodeList while they are text-like and visible
        while (i < nodeList.length && elements.length < maxElements) {
          const next = nodeList[i];
          const nextTag = next.tagName && next.tagName.toLowerCase();
          if (!nextTag || !TEXT_TAGS.has(nextTag)) break;
          if (!isVisible(next)) {
            i++;
            continue;
          }
          const nextText = extractText(next);
          if (nextText) combinedText += (combinedText ? " " : "") + nextText;
          i++;
        }

        if (combinedText.length > maxTextLen)
          combinedText = combinedText.slice(0, maxTextLen).trim() + "…";
        elements.push({ tag: "text", text: combinedText, attrs: {} });
        continue;
      }

      // Non-text element: include its tag, short text and allowed attributes
      const item = {
        tag,
        text: extractText(el),
        attrs: gatherAttributes(el),
      };
      elements.push(item);
    }
  } catch (e) {
    console.warn(
      "sanitizeAndSerializeDocument partial result due to error:",
      e
    );
  }

  const structured = {
    url: (doc.location && doc.location.href) || "",
    timestamp: Date.now(),
    elements,
  };

  // Return compact JSON string suitable for LLM consumption. Keeps tokens low.
  return JSON.stringify(structured);
}

// --------------------------------------------------------------------
