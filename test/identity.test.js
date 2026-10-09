import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { base58Encode, base58Decode } from '../src/base58.js';
import { generateIdentity, publicKeyToDid, didToPublicKey, fingerprintOf, kvPathOf } from '../src/identity.js';

test('base58 gidiş-dönüş ve baştaki sıfırlar', () => {
  const bytes = Uint8Array.from([0, 0, 1, 2, 255]);
  const enc = base58Encode(bytes);
  assert.ok(enc.startsWith('11'));
  assert.deepEqual(base58Decode(enc), bytes);
});

test('did:key z6Mk ile başlar ve geri çözülür', () => {
  const id = generateIdentity();
  assert.match(id.did, /^did:key:z6Mk[1-9A-HJ-NP-Za-km-z]+$/);
  const raw = didToPublicKey(id.did);
  assert.equal(raw.length, 32);
  assert.equal(publicKeyToDid(raw), id.did);
});

test('fingerprint = sha256(did) ilk 16 hex', () => {
  const did = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
  const expected = createHash('sha256').update(did).digest('hex').slice(0, 16);
  assert.equal(fingerprintOf(did), expected);
  assert.match(fingerprintOf(did), /^[0-9a-f]{16}$/);
  const { ns, key } = kvPathOf(expected);
  assert.equal(ns, `did-${expected.slice(0, 2)}`);
  assert.equal(key, expected.slice(2));
  assert.equal(key.length, 14);
});
