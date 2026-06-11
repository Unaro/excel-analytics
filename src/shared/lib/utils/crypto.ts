/**
 * Сессионная обфускация конфигурации подключения PostgreSQL.
 *
 * ЧЕСТНАЯ МОДЕЛЬ УГРОЗ (см. docs/security/pg-credentials-threat-model.md):
 * это НЕ криптографическая защита. AES-ключ лежит в sessionStorage рядом
 * с шифртекстом, поэтому любой код, исполняющийся на странице (XSS),
 * прочитает и то и другое. Перед запросом конфиг расшифровывается и
 * передаётся Server Action в открытом виде.
 *
 * Что эта схема ДАЁТ:
 * - пароль не лежит в storage открытым текстом (защита от случайного
 *   просмотра/копирования содержимого DevTools и бэкапов профиля);
 * - время жизни секрета ограничено вкладкой (sessionStorage очищается
 *   при закрытии).
 *
 * Чего НЕ ДАЁТ: защиты от XSS и любого кода с доступом к JS-контексту.
 * Решение принято осознанно (client-first приложение без серверного
 * хранилища секретов); пользователь предупреждается в форме подключения.
 */
const ALGO = 'AES-GCM';
const KEY_NAME = 'pg_crypto_key';

/**
 * Возвращает сессионный AES-ключ, создавая его при первом обращении.
 *
 * @throws Error при вызове вне браузера (SSR).
 */
async function getOrCreateKey(): Promise<CryptoKey> {
  if (typeof window === 'undefined') throw new Error('Crypto only available in browser');

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

/**
 * Обфусцирует объект конфигурации сессионным ключом (AES-GCM).
 *
 * Результат пригоден только в рамках текущей сессии браузера —
 * после закрытия вкладки ключ утерян и payload не расшифровать.
 */
export async function encryptConfig<T extends object>(config: T): Promise<string> {
  const key = await getOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(config));
  const encrypted = await crypto.subtle.encrypt({ name: ALGO, iv }, key, encoded);

  const payload = {
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  };
  return JSON.stringify(payload);
}

/**
 * Расшифровывает payload, созданный {@link encryptConfig} в этой же сессии.
 *
 * @throws Error если ключ сессии не совпадает (новая сессия) или payload
 *   повреждён.
 */
export async function decryptConfig<T = Record<string, unknown>>(cipher: string): Promise<T> {
  const key = await getOrCreateKey();
  const { iv, data } = JSON.parse(cipher);

  const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  const dataBuffer = Uint8Array.from(atob(data), c => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt({ name: ALGO, iv: ivBuffer }, key, dataBuffer);
  return JSON.parse(new TextDecoder().decode(decrypted));
}
