import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { appendFile, open, rm, stat, writeFile } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

const MAGIC = Buffer.from('NXBK0001');
function keyBytes(hex: string) {
  if (!/^[a-f0-9]{64}$/i.test(hex)) throw new Error('Backup encryption needs a 32-byte hex key.');
  return Buffer.from(hex, 'hex');
}

// Versioned format: magic (8), IV (12), ciphertext, GCM authentication tag (16).
// The key is supplied by the deployment secret store, never kept in an archive.
export async function encryptBackup(source: string, destination: string, hexKey: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', keyBytes(hexKey), iv);
  cipher.setAAD(MAGIC);
  await writeFile(destination, Buffer.concat([MAGIC, iv]), { flag: 'wx', mode: 0o600 });
  try {
    await pipeline(createReadStream(source), cipher, createWriteStream(destination, { flags: 'a', mode: 0o600 }));
    await appendFile(destination, cipher.getAuthTag());
  } catch (error) { await rm(destination, { force: true }); throw error; }
}

export async function decryptBackup(source: string, destination: string, hexKey: string) {
  const size = (await stat(source)).size;
  if (size < 36) throw new Error('Invalid encrypted backup.');
  const file = await open(source, 'r');
  const header = Buffer.alloc(20), tag = Buffer.alloc(16);
  try { await file.read(header, 0, 20, 0); await file.read(tag, 0, 16, size - 16); }
  finally { await file.close(); }
  if (!header.subarray(0, 8).equals(MAGIC)) throw new Error('Unsupported backup encryption format.');
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(hexKey), header.subarray(8));
  decipher.setAAD(MAGIC); decipher.setAuthTag(tag);
  try {
    await pipeline(createReadStream(source, { start: 20, end: size - 17 }), decipher, createWriteStream(destination, { flags: 'wx', mode: 0o600 }));
  } catch (error) { await rm(destination, { force: true }); throw error; }
}

export function isCredentialFile(name: string) {
  return /^\.env(?:\.|$)/i.test(name) || /^\.dev-credentials$/i.test(name) || /\.(?:pem|key|p12|pfx)$/i.test(name);
}
