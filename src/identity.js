import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { base58Decode, base58Encode } from './base58.js';

// multicodec ed25519-pub = 0xed, varint kodlanmış hali: 0xed 0x01
const ED25519_PUB_PREFIX = Uint8Array.from([0xed, 0x01]);

export function publicKeyToDid(rawPublicKey) {
  if (rawPublicKey.length !== 32) throw new Error('Ed25519 public key 32 bayt olmalı');
  const payload = new Uint8Array(ED25519_PUB_PREFIX.length + 32);
  payload.set(ED25519_PUB_PREFIX, 0);
  payload.set(rawPublicKey, ED25519_PUB_PREFIX.length);
  return `did:key:z${base58Encode(payload)}`;
}

export function didToPublicKey(did) {
  if (!did.startsWith('did:key:z')) throw new Error('Yalnızca did:key:z... desteklenir');
  const payload = base58Decode(did.slice('did:key:z'.length));
  if (payload.length !== 34 || payload[0] !== 0xed || payload[1] !== 0x01) {
    throw new Error('DID ed25519-pub multicodec önekine sahip değil');
  }
  return payload.slice(2);
}

export function fingerprintOf(did) {
  return createHash('sha256').update(did, 'utf8').digest('hex').slice(0, 16);
}

// Fingerprint'i Technocore'un parçalı KV yoluna böler: did-<ilk2> / <kalan14>
export function kvPathOf(fingerprint) {
  return { ns: `did-${fingerprint.slice(0, 2)}`, key: fingerprint.slice(2) };
}

export function generateIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const jwk = privateKey.export({ format: 'jwk' });
  const rawPublic = Buffer.from(jwk.x, 'base64url');
  const did = publicKeyToDid(rawPublic);
  return {
    did,
    fingerprint: fingerprintOf(did),
    privateKey,
    publicKey,
    secretRecord: {
      version: 1,
      createdAt: new Date().toISOString(),
      did,
      privateKeyJwk: jwk,
      lastNonces: {},
    },
  };
}

export function loadIdentity(path) {
  const record = JSON.parse(readFileSync(path, 'utf8'));
  const privateKey = createPrivateKey({ key: record.privateKeyJwk, format: 'jwk' });
  const publicKey = createPublicKey(privateKey);
  const rawPublic = Buffer.from(record.privateKeyJwk.x, 'base64url');
  const did = publicKeyToDid(rawPublic);
  if (record.did && record.did !== did) throw new Error('Kayıtlı DID ile anahtar uyuşmuyor');
  record.lastNonces ??= {};
  return { did, fingerprint: fingerprintOf(did), privateKey, publicKey, secretRecord: record };
}

export function saveSecret(path, record) {
  writeFileSync(path, JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
}

export function loadOrCreateIdentity(path) {
  if (existsSync(path)) return { identity: loadIdentity(path), created: false };
  const identity = generateIdentity();
  saveSecret(path, identity.secretRecord);
  return { identity, created: true };
}
