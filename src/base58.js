// Bitcoin alfabesiyle base58 kodlama (multibase 'z' öneki için gerekli).
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes) {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);

  let out = '';
  while (value > 0n) {
    out = ALPHABET[Number(value % 58n)] + out;
    value /= 58n;
  }

  // Baştaki sıfır baytlar '1' karakteriyle korunur.
  for (const byte of bytes) {
    if (byte !== 0) break;
    out = '1' + out;
  }
  return out;
}

export function base58Decode(text) {
  let value = 0n;
  for (const ch of text) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`Geçersiz base58 karakteri: ${ch}`);
    value = value * 58n + BigInt(idx);
  }

  const bytes = [];
  while (value > 0n) {
    bytes.unshift(Number(value & 0xffn));
    value >>= 8n;
  }
  for (const ch of text) {
    if (ch !== '1') break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}
