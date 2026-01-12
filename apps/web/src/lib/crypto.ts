/**
 * Client-side encryption utilities for API keys
 * 
 * This module provides end-to-end encryption where:
 * - Encryption key is generated and stored locally in the browser
 * - Server never sees the raw API key
 * - Admin cannot decrypt without user's local key
 */

const STORAGE_KEY_PREFIX = 'mirror_enc_key_';
const ENCRYPTION_VERSION = 'v2:';

export function isWebCryptoAvailable(): boolean {
    return typeof globalThis !== 'undefined'
        && typeof globalThis.crypto !== 'undefined'
        && typeof globalThis.crypto.subtle !== 'undefined';
}

// Generate a random 256-bit key
async function generateEncryptionKey(): Promise<CryptoKey> {
    if (!isWebCryptoAvailable()) {
        throw new Error('WebCryptoUnavailable');
    }
    return crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true, // extractable
        ['encrypt', 'decrypt']
    );
}

// Export key to storable format
async function exportKey(key: CryptoKey): Promise<string> {
    if (!isWebCryptoAvailable()) {
        throw new Error('WebCryptoUnavailable');
    }
    const exported = await crypto.subtle.exportKey('raw', key);
    const bytes = new Uint8Array(exported);
    return btoa(Array.from(bytes).map(b => String.fromCharCode(b)).join(''));
}

// Import key from stored format
async function importKey(keyString: string): Promise<CryptoKey> {
    if (!isWebCryptoAvailable()) {
        throw new Error('WebCryptoUnavailable');
    }
    const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
    return crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

// Get or create user's encryption key
export async function getUserEncryptionKey(userId: string): Promise<CryptoKey> {
    if (!isWebCryptoAvailable()) {
        throw new Error('WebCryptoUnavailable');
    }
    const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;

    // Check if key exists in localStorage
    const existingKey = localStorage.getItem(storageKey);
    if (existingKey) {
        return importKey(existingKey);
    }

    // Generate new key
    const newKey = await generateEncryptionKey();
    const exportedKey = await exportKey(newKey);
    localStorage.setItem(storageKey, exportedKey);

    return newKey;
}

// Check if user has an encryption key
export function hasEncryptionKey(userId: string): boolean {
    if (!isWebCryptoAvailable()) return false;
    const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
    return localStorage.getItem(storageKey) !== null;
}

// Encrypt API key client-side
export async function encryptApiKeyClientSide(
    apiKey: string,
    userId: string
): Promise<string> {
    if (!isWebCryptoAvailable()) {
        throw new Error('WebCryptoUnavailable');
    }
    const key = await getUserEncryptionKey(userId);

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encoder = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encoder.encode(apiKey)
    );

    // Combine IV + ciphertext and encode
    const ivBase64 = btoa(Array.from(iv).map(b => String.fromCharCode(b)).join(''));
    const encryptedBytes = new Uint8Array(encrypted);
    const dataBase64 = btoa(Array.from(encryptedBytes).map(b => String.fromCharCode(b)).join(''));

    return `${ENCRYPTION_VERSION}${ivBase64}:${dataBase64}`;
}

// Decrypt API key client-side
export async function decryptApiKeyClientSide(
    encryptedKey: string,
    userId: string
): Promise<string | null> {
    if (!isWebCryptoAvailable()) {
        return null;
    }
    // Check if it's our format
    if (!encryptedKey.startsWith(ENCRYPTION_VERSION)) {
        // Old format or plain text - cannot decrypt client-side
        return null;
    }

    const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
    const storedKey = localStorage.getItem(storageKey);

    if (!storedKey) {
        // No local key - cannot decrypt
        return null;
    }

    try {
        const key = await importKey(storedKey);

        const payload = encryptedKey.slice(ENCRYPTION_VERSION.length);
        const [ivBase64, dataBase64] = payload.split(':');

        const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
        const data = Uint8Array.from(atob(dataBase64), c => c.charCodeAt(0));

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            data
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (error) {
        console.error('Decryption failed:', error);
        return null;
    }
}

// Export the local key (for backup purposes)
export async function exportLocalKey(userId: string): Promise<string | null> {
    const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
    return localStorage.getItem(storageKey);
}

// Import a backup key
export async function importLocalKey(userId: string, keyString: string): Promise<boolean> {
    try {
        // Validate it's a valid key
        await importKey(keyString);

        const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
        localStorage.setItem(storageKey, keyString);
        return true;
    } catch {
        return false;
    }
}
