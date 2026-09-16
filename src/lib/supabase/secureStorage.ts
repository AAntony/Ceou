import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-get-random-values';
import { createEncryptedStorage } from './encryptedStorage';

// Native: only the key is kept in SecureStore; sessions can exceed its value size limit.
// Web: SecureStore is unavailable, so retain the existing AsyncStorage adapter.
export const largeSecureStore = Platform.OS === 'web' ? AsyncStorage : createEncryptedStorage(
  AsyncStorage,
  { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync, removeItem: SecureStore.deleteItemAsync },
  (length) => crypto.getRandomValues(new Uint8Array(length)),
);
