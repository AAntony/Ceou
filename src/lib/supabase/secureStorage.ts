import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';
import 'react-native-get-random-values';

/**
 * expo-secure-store caps values at 2048 bytes, too small for a Supabase
 * session (access + refresh token). We store only a random AES key in
 * SecureStore and keep the (encrypted) session payload in AsyncStorage.
 * Pattern documented by Supabase for Expo/React Native.
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
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;

    const encryptionKey = await this.getEncryptionKey(`${key}-key`);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const bytes = cipher.decrypt(aesjs.utils.hex.toBytes(encrypted));
    return aesjs.utils.utf8.fromBytes(bytes);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = await this.getEncryptionKey(`${key}-key`);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const bytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await AsyncStorage.setItem(key, aesjs.utils.hex.fromBytes(bytes));
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(`${key}-key`);
  }
}

export const largeSecureStore = new LargeSecureStore();
