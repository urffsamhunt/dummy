function checkAndOpenPopup(tab) {
  console.log("Opening");
    browser.action.openPopup();
  }

// We listen for when the active tab's URL is updated.
// This handles cases where a new URL is navigated to within the same tab.
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the change is a complete page load and if the tab is currently active.
  if (changeInfo.status === 'complete' && tab.active) {
    checkAndOpenPopup(tab);
  }
});

// We also listen for when the user switches to a different tab.
browser.tabs.onActivated.addListener(activeInfo => {
  // Get the full tab object using its ID from activeInfo.
  browser.tabs.get(activeInfo.tabId, (tab) => {
    checkAndOpenPopup(tab);
  });
});
