import crypto from 'crypto';

const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const DIGEST = 'sha512';

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) return resolve(false);
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err, derivedKey) => {
      if (err) reject(err);
      resolve(crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derivedKey));
    });
  });
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function createSessionExpiry(hours: number = 168): Date {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d;
}
