import CryptoJS from "crypto-js";

// Hardcoded local key for browser-level encryption. 
// This deters casual inspection of localStorage, but is not bank-grade security since the key is in the client bundle.
const SECRET_KEY = "asclepius-local-secure-key-2026";

/**
 * Encrypts an object and stores it in localStorage.
 */
export function secureSetItem(key: string, data: any): void {
  try {
    const jsonString = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(jsonString, SECRET_KEY).toString();
    localStorage.setItem(key, encrypted);
  } catch (error) {
    console.error(`[Crypto] Failed to encrypt data for key: ${key}`, error);
    // Fallback to unencrypted if encryption fails
    localStorage.setItem(key, JSON.stringify(data));
  }
}

/**
 * Decrypts an object from localStorage.
 * Falls back to normal JSON.parse if the stored value is not encrypted.
 */
export function secureGetItem<T>(key: string, fallback: T): T {
  const saved = localStorage.getItem(key);
  if (!saved) return fallback;

  try {
    // Attempt to decrypt
    const decryptedBytes = CryptoJS.AES.decrypt(saved, SECRET_KEY);
    const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);
    
    if (decryptedText) {
      return JSON.parse(decryptedText);
    }
  } catch (e) {
    // If decryption fails, it might be legacy unencrypted data
  }

  try {
    return JSON.parse(saved);
  } catch (e) {
    return fallback;
  }
}
