// PBKDF2 password hashing using Web Crypto API — works in Vercel Node runtime.

const ITERATIONS = 100_000;
const KEYLEN = 32;
const DIGEST = 'SHA-256';

function bufToHex(buf) {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return bytes;
}

export async function hashPassword(password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: DIGEST },
    keyMaterial, KEYLEN * 8
  );
  return `pbkdf2$${ITERATIONS}$${bufToHex(salt)}$${bufToHex(bits)}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [algo, iter, saltHex, hashHex] = stored.split('$');
    if (algo !== 'pbkdf2') return false;
    const salt = hexToBuf(saltHex);
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: Number(iter), hash: DIGEST },
      keyMaterial, KEYLEN * 8
    );
    return bufToHex(bits) === hashHex;
  } catch { return false; }
}
