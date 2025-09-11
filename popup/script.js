window.addEventListener('DOMContentLoaded', () => {
  const svg = document.querySelector('#popup-content svg');
  if (!svg) return;

  svg.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.2)' },
      { transform: 'scale(1)' },
    ],
    {
      duration: 3000,
      iterations: Infinity,
      easing: 'linear',
    }
  );
});

function parseAndSanitize() {
  const input = document.getElementById('htmlInput').value;
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');
  let bodyContent = doc.body.innerHTML;

  bodyContent = bodyContent
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[\s\S]*?<\/embed>/gi, '')
    .replace(/<link[\s\S]*?>/gi, '')
    .replace(/<meta[\s\S]*?>/gi, '');

  document.getElementById('result').textContent = bodyContent;
}