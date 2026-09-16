import aes from 'aes-js';
import { createSerialTasks } from '../serialTasks';

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};
type RandomBytes = (length: number) => Uint8Array;
const isHex = (value: string) => value.length % 2 === 0 && /^[\da-f]*$/i.test(value);

/** AES keys stay in the OS keychain. Payloads use a fresh 128-bit counter for every write. */
export function createEncryptedStorage(payloads: Storage, keys: Storage, randomBytes: RandomBytes): Storage {
  const run = createSerialTasks();
  return {
    getItem: (key) => run(key, async () => {
      const encrypted = await payloads.getItem(key);
      if (!encrypted) return null;
      const keyHex = await keys.getItem(`${key}-key`);
      // A restored backup may contain ciphertext without its device key. Never invent a new key to read it.
      if (!keyHex || keyHex.length !== 64 || !isHex(keyHex)) return null;
      const parts = encrypted.split(':');
      const versioned = parts.length === 3 && parts[0] === 'v2';
      const ciphertext = versioned ? parts[2] : encrypted;
      if (!isHex(ciphertext) || (versioned && (parts[1].length !== 32 || !isHex(parts[1])))) return null;
      try {
        // Existing installations used counter 1. Read them until the next auth refresh rewrites the record.
        const counter = versioned ? aes.utils.hex.toBytes(parts[1]) : 1;
        const cipher = new aes.ModeOfOperation.ctr(aes.utils.hex.toBytes(keyHex), new aes.Counter(counter));
        return new TextDecoder('utf-8', { fatal: true }).decode(cipher.decrypt(aes.utils.hex.toBytes(ciphertext)));
      } catch {
        return null;
      }
    }),
    setItem: (key, value) => run(key, async () => {
      const keyName = `${key}-key`;
      let keyHex = await keys.getItem(keyName);
      if (!keyHex || keyHex.length !== 64 || !isHex(keyHex)) {
        keyHex = aes.utils.hex.fromBytes(randomBytes(32)) as string;
        await keys.setItem(keyName, keyHex);
      }
      const nonce = randomBytes(16);
      const cipher = new aes.ModeOfOperation.ctr(aes.utils.hex.toBytes(keyHex), new aes.Counter(nonce));
      const encrypted = aes.utils.hex.fromBytes(cipher.encrypt(new TextEncoder().encode(value)));
      await payloads.setItem(key, `v2:${aes.utils.hex.fromBytes(nonce)}:${encrypted}`);
    }),
    removeItem: (key) => run(key, async () => {
      await payloads.removeItem(key);
      await keys.removeItem(`${key}-key`);
    }),
  };
}
