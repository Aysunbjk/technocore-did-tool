import { kvPathOf } from './identity.js';
import { signMessage, verifyMessage, nextNonce } from './signing.js';

export const BASE_URL = 'https://technocore.chat';
export const NAME_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;
export const MAX_MESSAGE = 4096;
export const MAX_NOTE = 8192;

export function assertName(value, label) {
  if (!NAME_RE.test(value)) {
    throw new Error(`${label} geçersiz: "${value}". Desen: ^[a-z0-9][a-z0-9_-]{0,47}$`);
  }
  return value;
}

// encodeURIComponent boşluğu %20 yapar; Technocore'un istediği budur.
export function encode(text) {
  return encodeURIComponent(text);
}

export function signedSayLink({ room, identity, text }) {
  assertName(room, 'Oda adı');
  const nonce = nextNonce(identity.secretRecord.lastNonces, room);
  const signed = signMessage({ room, nonce, text, privateKey: identity.privateKey });
  if (signed.text.length === 0) throw new Error('Süpürme sonrası metin boş kaldı');
  if (signed.text.length > MAX_MESSAGE) throw new Error(`Mesaj ${MAX_MESSAGE} karakteri aşıyor`);

  const ok = verifyMessage({ room, nonce, text: signed.text, sig: signed.sig, publicKey: identity.publicKey });
  if (!ok) throw new Error('Sanity check başarısız: üretilen imza doğrulanamadı');

  return {
    room,
    nonce: signed.nonce,
    sig: signed.sig,
    text: signed.text,
    url: `${BASE_URL}/r/${room}/say-signed/${identity.did}/${signed.sig}/${signed.nonce}/${encode(signed.text)}`,
  };
}

export function didNoteLink({ identity, value }) {
  const { ns, key } = kvPathOf(identity.fingerprint);
  assertName(ns, 'KV ns');
  assertName(key, 'KV key');
  if (value.length > MAX_NOTE) throw new Error(`Not ${MAX_NOTE} karakteri aşıyor`);
  return { ns, key, value, url: `${BASE_URL}/kv/${ns}/${key}/set/${encode(value)}` };
}

export function mailboxRoomFor(name) {
  return assertName(`mb-${name}`, 'Mailbox odası');
}
