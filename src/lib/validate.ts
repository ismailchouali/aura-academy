// Input validation and sanitization utilities

export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return '';
  // Remove null bytes and trim
  return input.replace(/\0/g, '').trim();
}

export function sanitizeEmail(email: unknown): string {
  const cleaned = sanitizeString(email);
  // Lowercase and limit length
  return cleaned.toLowerCase().slice(0, 254);
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 4 && password.length <= 128;
}

export function isValidPhone(phone: string): boolean {
  if (!phone) return true; // phone is optional
  const cleaned = phone.replace(/[\s\-\+\(\)]/g, '');
  return /^\d{8,15}$/.test(cleaned);
}

export function isValidName(name: string): boolean {
  return typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 200;
}

export function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length > 0 && id.length <= 100;
}

export function isValidMoney(amount: number): boolean {
  return typeof amount === 'number' && !isNaN(amount) && amount >= 0 && amount <= 99999999;
}

export function sanitizeNumber(input: unknown, min = 0, max = 99999999): number | null {
  const num = Number(input);
  if (isNaN(num) || num < min || num > max) return null;
  return num;
}

export function limitString(input: string, maxLength: number): string {
  return input.slice(0, maxLength);
}
