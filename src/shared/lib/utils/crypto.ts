const ALGO = 'AES-GCM';
const KEY_NAME = 'pg_crypto_key';


async function getOrCreateKey(): Promise<CryptoKey> {
  if (typeof window === 'undefined') throw new Error('Crypto only available in browser');
  
  const legacyKey = localStorage.getItem(KEY_NAME);
  if (legacyKey) {
    sessionStorage.setItem(KEY_NAME, legacyKey);
    localStorage.removeItem(KEY_NAME);
    console.log('[Crypto] Migrated key from localStorage to sessionStorage');
  }
  
  let rawKey = sessionStorage.getItem(KEY_NAME);
  
  if (!rawKey) {
    const key = await crypto.subtle.generateKey(
      { name: ALGO, length: 256 }, 
      true, 
      ['encrypt', 'decrypt']
    );
    const exported = await crypto.subtle.exportKey('raw', key);
    rawKey = btoa(String.fromCharCode(...new Uint8Array(exported)));
    sessionStorage.setItem(KEY_NAME, rawKey);
  }
  
  const keyData = Uint8Array.from(atob(rawKey), c => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', keyData, ALGO, true, ['encrypt', 'decrypt']);
}

export async function encryptConfig<T extends object>(config: T): Promise<string> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(config));
  const encrypted = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded);
  
  const payload = {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  };
  return JSON.stringify(payload);
}

export async function decryptConfig<T = Record<string, unknown>>(cipher: string): Promise<T> {
  const key = await getOrCreateKey();
  const { iv, data } = JSON.parse(cipher);
  
  const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const dataBuffer = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv: ivBuffer }, key, dataBuffer);
  return JSON.parse(new TextDecoder().decode(decrypted));
}