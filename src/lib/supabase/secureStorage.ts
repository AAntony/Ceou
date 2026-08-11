import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-get-random-values';

/**
 * expo-secure-store caps values at 2048 bytes, too small for a Supabase
 * session (access + refresh token). We store only a random AES key in
 * SecureStore and keep the (encrypted) session payload in AsyncStorage.
 * Pattern documented by Supabase for Expo/React Native.
 *
 * expo-secure-store has no web implementation at all (browsers have no
 * keychain to back it) — the target platform is Android, web is only used
 * for quick dev-server checks, so it falls back to plain AsyncStorage there.
 */
class LargeSecureStore {
  private async getEncryptionKey(keyName: string): Promise<Uint8Array> {
    const existing = await SecureStore.getItemAsync(keyName);
    if (existing) return aesjs.utils.hex.toBytes(existing);

    const key = crypto.getRandomValues(new Uint8Array(32));
    await SecureStore.setItemAsync(keyName, aesjs.utils.hex.fromBytes(key));
    return key;
  }

  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);

    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;

    const encryptionKey = await this.getEncryptionKey(`${key}-key`);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const bytes = cipher.decrypt(aesjs.utils.hex.toBytes(encrypted));
    return aesjs.utils.utf8.fromBytes(bytes);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);

    const encryptionKey = await this.getEncryptionKey(`${key}-key`);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const bytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await AsyncStorage.setItem(key, aesjs.utils.hex.fromBytes(bytes));
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    if (Platform.OS === 'web') return;
    await SecureStore.deleteItemAsync(`${key}-key`);
  }
}

export const largeSecureStore = new LargeSecureStore();
