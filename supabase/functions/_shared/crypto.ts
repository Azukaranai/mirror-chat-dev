const ENCRYPTION_PREFIX = 'v1:';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function deriveKey(secret: string): Promise<CryptoKey> {
    const hash = await crypto.subtle.digest('SHA-256', textEncoder.encode(secret));
    return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptApiKey(plain: string, secret: string): Promise<string> {
    if (!secret) {
        throw new Error('Missing ENCRYPTION_SECRET');
    }

    const key = await deriveKey(secret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, textEncoder.encode(plain));

    return `${ENCRYPTION_PREFIX}${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptApiKey(payload: string, secret?: string): Promise<string> {
    if (!payload.startsWith(ENCRYPTION_PREFIX)) {
        return payload;
    }

    if (!secret) {
        throw new Error('Missing ENCRYPTION_SECRET');
    }

    const parts = payload.slice(ENCRYPTION_PREFIX.length).split(':');
    if (parts.length !== 2) {
        throw new Error('Invalid encrypted payload');
    }

    const [ivBase64, dataBase64] = parts;
    const key = await deriveKey(secret);
    const iv = fromBase64(ivBase64);
    const data = fromBase64(dataBase64);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);

    return textDecoder.decode(plaintext);
}

export function isEncryptedPayload(value: string): boolean {
    return value.startsWith(ENCRYPTION_PREFIX);
}
