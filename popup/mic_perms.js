document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('requestMic');
  const status = document.getElementById('permStatus');

  function setStatus(msg) {
    if (status) status.textContent = msg;
  }

  if (!btn) {
    setStatus('Request button not found.');
    return;
  }

  btn.addEventListener('click', async () => {
    try {
      setStatus('Requesting microphone access...');
      // This will open the browser permission prompt for microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // If we get here, permission was granted (or already available)
      setStatus('Microphone access granted.');
      // stop tracks immediately (we only needed permission)
      stream.getTracks().forEach(t => t.stop());
    } catch (err) {
      setStatus('Microphone access denied or error: ' + (err && err.message ? err.message : err));
    }
  });
});