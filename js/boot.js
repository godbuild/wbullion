const STEP_DELAY = 400;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function checkNigeria() {
  // Vercel injects this header automatically once deployed.
  // Locally it's absent — we default to allowing through in dev.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch('/api/env', { signal: controller.signal }); // any request to Vercel carries the header
    const country = res.headers.get('x-vercel-ip-country');
    if (!country) return true; // dev / preview → allow
    return country === 'NG';
  } catch {
    return true;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkDevice() {
  const deviceId = localStorage.getItem('wb_device_id');
  return !!deviceId;
}

async function detectTheme() {
  const saved = localStorage.getItem('wb_theme');
  return saved || 'system';
}

export async function runBoot(onStep) {
  const stepEl = document.getElementById('bootStep');
  const nameEl = document.getElementById('bootName');
  const screen = document.getElementById('bootScreen');

  const setStep = (text) => {
    onStep?.(text);
    if (stepEl) stepEl.textContent = text;
  };

  // Step 0: show name for 2s
  setStep('');
  await sleep(2000);
  nameEl?.classList.add('fade-out');

  // Step 1: IP check
  setStep('Recognising IP Address...');
  const isNigeria = await checkNigeria();
  await sleep(STEP_DELAY);

  // Step 2: device check
  setStep('Checking device...');
  const hasDevice = await checkDevice();
  const theme = await detectTheme();
  await sleep(STEP_DELAY);

  // Fade out boot screen
  screen?.classList.add('fade-out');
  await sleep(500);
  screen?.classList.add('hidden');

  return { isNigeria, hasDevice, theme };
}
