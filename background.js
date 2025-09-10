browser.commands.onCommand.addListener((command) => {
  if (command === "open-popup") {
    browser.action.openPopup();
  }
});
