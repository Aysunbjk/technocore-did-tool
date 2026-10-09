import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateIdentity } from '../src/identity.js';
import { sweep, signMessage, verifyMessage, nextNonce } from '../src/signing.js';
import { signedSayLink, didNoteLink, assertName } from '../src/links.js';

test('süpürme kontrol/format karakterlerini boşluk yapar ve kırpar', () => {
  assert.equal(sweep('  a\nb\tc​d e  '), 'a b c d e');
  assert.equal(sweep('düz metin'), 'düz metin');
});

test('imza süpürülmüş metni kapsar, 86 karakter base64url', () => {
  const id = generateIdentity();
  const s = signMessage({ room: 'lobby', nonce: 1, text: 'hello\nworld', privateKey: id.privateKey });
  assert.equal(s.text, 'hello world');
  assert.equal(s.sig.length, 86);
  assert.match(s.sig, /^[A-Za-z0-9_-]{86}$/);
  assert.ok(verifyMessage({ room: 'lobby', nonce: 1, text: 'hello world', sig: s.sig, publicKey: id.publicKey }));
  assert.ok(!verifyMessage({ room: 'lobby', nonce: 2, text: 'hello world', sig: s.sig, publicKey: id.publicKey }));
  assert.ok(!verifyMessage({ room: 'other', nonce: 1, text: 'hello world', sig: s.sig, publicKey: id.publicKey }));
});

test('nonce aynı odada monoton artar', () => {
  const last = {};
  const a = nextNonce(last, 'lobby');
  const b = nextNonce(last, 'lobby');
  assert.ok(b > a);
  assert.ok(String(b).length <= 19);
});

test('say-signed linki beklenen biçimde', () => {
  const id = generateIdentity();
  const r = signedSayLink({ room: 'lobby', identity: id, text: 'hi there' });
  assert.equal(r.url, `https://technocore.chat/r/lobby/say-signed/${id.did}/${r.sig}/${r.nonce}/hi%20there`);
});

test('kv notu linki parçalı yolu kullanır', () => {
  const id = generateIdentity();
  const r = didNoteLink({ identity: id, value: 'x: @me' });
  assert.equal(r.url, `https://technocore.chat/kv/did-${id.fingerprint.slice(0, 2)}/${id.fingerprint.slice(2)}/set/x%3A%20%40me`);
});

test('isim deseni', () => {
  assertName('mb-agent_1', 'x');
  assert.throws(() => assertName('Agent', 'x'));
  assert.throws(() => assertName('-bad', 'x'));
});
