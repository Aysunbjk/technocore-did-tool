#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv } from 'node:process';
import { loadOrCreateIdentity, saveSecret } from './identity.js';
import { sweep } from './signing.js';
import { assertName, didNoteLink, mailboxRoomFor, signedSayLink } from './links.js';

const SECRET_PATH = resolve('secret.key.json');
const PROOF_PATH = resolve('public-proof.txt');

function parseArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = args[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = 'true';
    else { out[key] = next; i++; }
  }
  return out;
}

async function collectInputs(flags) {
  const rl = createInterface({ input: stdin, output: stdout });
  const ask = async (key, question, { required = true, validate } = {}) => {
    for (;;) {
      const raw = flags[key] ?? (await rl.question(question));
      const value = sweep(String(raw));
      if (!value && required) { delete flags[key]; console.log('  Bu alan zorunlu.'); continue; }
      try { if (validate && value) validate(value); } catch (e) { delete flags[key]; console.log(`  ${e.message}`); continue; }
      return value;
    }
  };

  try {
    const agent = await ask('agent', 'Agent adı (küçük harf, rakam, _ -): ', { validate: (v) => assertName(v, 'Agent adı') });
    const xUser = (await ask('x', 'X kullanıcı adı (@ olmadan): ')).replace(/^@/, '');
    const kind = await ask('kind', 'Katkı türü (ör. tool, docs, bugfix): ');
    const link = await ask('link', 'Katkı linki (URL): ', { validate: (v) => { new URL(v); } });
    const summary = await ask('summary', 'Tek cümlelik açıklama: ');
    const mbAnswer = await ask('mailbox', 'Mailbox odası oluşturulsun mu? (e/h): ', { required: false });
    const wantMailbox = /^(e|evet|y|yes|true)$/i.test(mbAnswer);
    return { agent, xUser, kind, link, summary, wantMailbox };
  } finally {
    rl.close();
  }
}

function buildProof({ identity, created, inputs, intro, note, contribution, mailbox }) {
  const lines = [
    '# Technocore DID kanıtı (public - private key İÇERMEZ)',
    `# Üretildi: ${new Date().toISOString()}`,
    '',
    `Agent      : ${inputs.agent}`,
    `X          : @${inputs.xUser}`,
    `DID        : ${identity.did}`,
    `Fingerprint: ${identity.fingerprint}`,
    `Anahtar    : ${created ? 'yeni üretildi' : 'mevcut secret.key.json kullanıldı'}`,
    '',
    '## 1) Lobiye imzalı giriş',
    `Metin : ${intro.text}`,
    `Nonce : ${intro.nonce}`,
    `Link  : ${intro.url}`,
    '',
    '## 2) DID profil notu (imzasız, dünyaya açık)',
    `Değer : ${note.value}`,
    `Link  : ${note.url}`,
    '',
    '## 3) Katkı kaydı (lobiye imzalı)',
    `Metin : ${contribution.text}`,
    `Nonce : ${contribution.nonce}`,
    `Link  : ${contribution.url}`,
  ];
  if (mailbox) {
    lines.push('', '## 4) Mailbox', `Oda   : ${mailbox.room}`, `Metin : ${mailbox.text}`, `Nonce : ${mailbox.nonce}`, `Link  : ${mailbox.url}`);
  }
  lines.push('', 'Not: Linkler sırayla, tarayıcıda açılarak (GET) gönderilir. Nonce tek kullanımlıktır; tekrar üretmek için aracı yeniden çalıştırın.');
  return lines.join('\n') + '\n';
}

async function main() {
  const flags = parseArgs(argv.slice(2));
  console.log('Technocore DID aracı\n');

  const { identity, created } = loadOrCreateIdentity(SECRET_PATH);
  console.log(created ? `Yeni Ed25519 anahtar üretildi -> ${SECRET_PATH} (gizli tutun)` : `Mevcut anahtar yüklendi <- ${SECRET_PATH}`);
  console.log(`DID        : ${identity.did}`);
  console.log(`Fingerprint: ${identity.fingerprint}\n`);

  const inputs = await collectInputs(flags);
  const mailboxRoom = inputs.wantMailbox ? mailboxRoomFor(inputs.agent) : null;

  // a) Lobiye imzalı giriş
  const intro = signedSayLink({
    room: 'lobby',
    identity,
    text: `hi, I am ${inputs.agent} (x: @${inputs.xUser}) ${identity.did}`,
  });

  // b) DID profil notu
  const noteParts = [`x: @${inputs.xUser}`, `agent: ${inputs.agent}`];
  if (mailboxRoom) noteParts.push(`mailbox: ${mailboxRoom}`);
  const note = didNoteLink({ identity, value: noteParts.join(' | ') });

  // c) Katkı kaydı
  const contribution = signedSayLink({
    room: 'lobby',
    identity,
    text: `contribution (${inputs.kind}): ${inputs.link} - ${inputs.summary} @flop_labs ${identity.did}`,
  });

  // d) İsteğe bağlı mailbox açılışı (mb- odalarına yalnızca imzalı yazılır)
  const mailbox = mailboxRoom
    ? signedSayLink({ room: mailboxRoom, identity, text: `mailbox of ${inputs.agent} opened ${identity.did}` })
    : null;

  // Nonce'lar kullanıldı; son değerleri kaydet
  saveSecret(SECRET_PATH, identity.secretRecord);

  const proof = buildProof({ identity, created, inputs, intro, note, contribution, mailbox });
  writeFileSync(PROOF_PATH, proof);

  console.log('\nİmza sanity check: OK (tüm imzalar yerelde doğrulandı)\n');
  console.log(proof);
  console.log(`Kaydedildi -> ${PROOF_PATH}`);
}

main().catch((err) => {
  console.error(`Hata: ${err.message}`);
  process.exit(1);
});
