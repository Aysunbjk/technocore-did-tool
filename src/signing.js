import { sign as edSign, verify as edVerify } from 'node:crypto';

// Technocore "tek satır süpürmesi": Cc, Cf, Cs, Co, Zl, Zp -> boşluk, sonra uçlar kırpılır.
const SWEEP_RE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Zl}\p{Zp}]/gu;

export function sweep(text) {
  return text.replace(SWEEP_RE, ' ').trim();
}

export function signingPayload(room, nonce, sweptText) {
  return Buffer.from(`${room}|${nonce}|${sweptText}`, 'utf8');
}

export function signMessage({ room, nonce, text, privateKey }) {
  const swept = sweep(text);
  const sig = edSign(null, signingPayload(room, nonce, swept), privateKey).toString('base64url');
  if (sig.length !== 86) throw new Error(`Beklenmeyen imza uzunluğu: ${sig.length}`);
  return { text: swept, sig, nonce: String(nonce) };
}

export function verifyMessage({ room, nonce, text, sig, publicKey }) {
  const sigBytes = Buffer.from(sig, 'base64url');
  if (sigBytes.length !== 64) return false;
  // Kanonik base64url kontrolü: yeniden kodlanınca aynı dize çıkmalı.
  if (sigBytes.toString('base64url') !== sig) return false;
  return edVerify(null, signingPayload(room, nonce, text), publicKey, sigBytes);
}

// Nonce: 1-19 hane, aynı anahtar+oda için öncekinden büyük. Milisaniye zaman damgası tabanlı.
export function nextNonce(lastNonces, room) {
  const last = Number(lastNonces[room] ?? 0);
  const nonce = Math.max(Date.now(), last + 1);
  if (String(nonce).length > 19) throw new Error('Nonce 19 haneyi aşıyor');
  lastNonces[room] = nonce;
  return nonce;
}
