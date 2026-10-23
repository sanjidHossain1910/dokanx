import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function setup({ platform = 'android', cancelled = false, failure = false, corrupt = false, exists = true, available = true } = {}) {
  const bytes = new Uint8Array([80, 75, 3, 4, 5, 6]);
  const entries = new Map(exists ? [['file:///private/backup.dokanx', bytes]] : []), calls = [];
  class File {
    constructor(uri) { this.uri = uri; }
    get exists() { return entries.has(this.uri); }
    get size() { return entries.get(this.uri)?.length ?? 0; }
    get name() { return this.uri.split('/').at(-1); }
    async bytes() { return entries.get(this.uri); }
    write(value) { const saved = new Uint8Array(value); if (corrupt) saved[saved.length - 1] ^= 1; entries.set(this.uri, saved); if (failure) throw new Error('disk full'); }
    delete() { calls.push(['delete', this.uri]); entries.delete(this.uri); }
  }
  const folder = { createFile(name, mime) {
    calls.push(['create', name, mime]); const uri = `content://chosen/${name}`;
    entries.set(uri, new Uint8Array()); return new File(uri);
  } };
  const modules = {
    'expo-file-system': { File, Directory: { pickDirectoryAsync: async () => {
      calls.push(['pick']); if (cancelled) throw Object.assign(new Error('cancel'), { code: 'ERR_PICKER_CANCELLED' });
      return folder;
    } } },
    'react-native': { Platform: { OS: platform } },
    'expo-sharing': { isAvailableAsync: async () => available, shareAsync: async (...args) => { calls.push(['share', ...args]); } },
    './backupFormat': { BACKUP_LIMIT: 60_000_000 },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/store/backupExport.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(source, { exports, require: id => { if (!(id in modules)) throw new Error(id); return modules[id]; }, Uint8Array, Error });
  return { ...exports, bytes, entries, calls, uri: 'file:///private/backup.dokanx' };
}

test('Android save exports exact archive bytes and extension into the chosen public folder without any share app', async () => {
  const a = setup({ available: false }); const saved = await a.saveBackup(a.uri);
  assert.equal(saved.name, 'backup.dokanx');
  assert.deepEqual(a.calls[1], ['create', 'backup.dokanx', 'application/x-dokanx']);
  assert.deepEqual(a.entries.get('content://chosen/backup.dokanx'), a.bytes);
  assert.deepEqual(a.entries.get(a.uri), a.bytes);
  assert.equal(a.calls.some(c => c[0] === 'share'), false);
});
test('cancelling folder selection creates nothing and does not claim the backup was saved', async () => {
  const a = setup({ cancelled: true }); assert.equal(await a.saveBackup(a.uri), undefined);
  assert.equal(a.entries.size, 1); assert.deepEqual(a.calls, [['pick']]);
});
test('same-size corrupted provider writes are detected and never reported as saved', async () => {
  const a = setup({ corrupt: true }); await assert.rejects(a.saveBackup(a.uri), /backupSaveFailed/);
  assert.equal(a.entries.size, 1); assert.deepEqual(a.entries.get(a.uri), a.bytes);
});
test('failed exports remove only the incomplete selected document and retain the source backup', async () => {
  const a = setup({ failure: true }); await assert.rejects(a.saveBackup(a.uri), /backupSaveFailed/);
  assert.equal(a.entries.size, 1); assert.ok(a.entries.has(a.uri));
  assert.deepEqual(a.calls.at(-1), ['delete', 'content://chosen/backup.dokanx']);
});
test('missing files and unavailable share clients report specific actionable errors', async () => {
  const missing = setup({ exists: false }); await assert.rejects(missing.saveBackup(missing.uri), /backupFileMissing/);
  await assert.rejects(missing.shareBackup(missing.uri), /backupFileMissing/); assert.deepEqual(missing.calls, []);
  const noShare = setup({ available: false }); await assert.rejects(noShare.shareBackup(noShare.uri), /backupShareUnavailable/);
});
test('iOS presents Save to Files in the share sheet without claiming that dismissal saved a file', async () => {
  const a = setup({ platform: 'ios' }); assert.equal(await a.saveBackup(a.uri), undefined);
  assert.equal(a.calls[0][0], 'share'); assert.equal(a.calls[0][1], a.uri);
  assert.equal(a.calls[0][2].UTI, 'public.data'); assert.equal(a.calls.some(c => c[0] === 'pick'), false);
});
