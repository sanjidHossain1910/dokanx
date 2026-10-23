import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyBusiness } from '../src/store/business.ts';
import { createCloudBackupController } from '../src/cloudBackup/controller.ts';
import { completeLocalPublication, localPublicationSettings, publishLocalShop, reviewLocalPublication } from '../src/cloudBackup/publish.ts';

function setup(existing = true) {
  let local = { ...emptyBusiness, shopId: 'local-shop', shopActive: true, shopName: 'Restored shop' };
  const shop = { id: 'owned-shop', localShopId: local.shopId, name: local.shopName };
  const old = { id: 'old', status: 'complete', createdAt: '2026-10-20T10:00:00Z', completedAt: '2026-10-20T10:00:00Z', snapshotHash: 'b'.repeat(64), archiveHash: 'c'.repeat(64), bytes: 100 };
  let head = { headId: existing ? old.id : null, epoch: existing ? 3 : 0, versions: existing ? [old] : [] };
  const events = []; let active = true, saved = '', fail = '', controller, time = 2_000_000, signature = 'a'.repeat(64), pending = true, onUpload = () => {};
  const current = () => { if (!active) throw new Error('backupContextChanged'); };
  const deps = {
    current, capture: () => local,
    begin: async () => { events.push('pause'); pending = true; },
    link: async () => { events.push('link'); return shop; },
    head: async () => ({ ...head, versions: [...head.versions] }),
    claim: async (_shop, reviewed) => {
      events.push('claim'); assert.equal(reviewed.headId, head.headId);
      head = { ...head, epoch: head.epoch + 1 };
      return { headId: head.headId, epoch: head.epoch };
    },
    publisher: async (_shop, reviewed) => {
      events.push('publisher'); saved = JSON.stringify(localPublicationSettings('restored-generation', reviewed));
      controller = createCloudBackupController({
        current: () => active, read: async () => saved, write: async raw => { saved = raw; },
        generation: async () => 'restored-generation', now: () => time, signature: async () => signature,
        prepare: async baseId => {
          events.push('prepare'); assert.equal(baseId, head.headId ?? undefined);
          return { requestKey: 'request', uri: 'file:///archive', signature, archiveHash: 'c'.repeat(64), bytes: 100, baseId };
        },
        exists: () => true, remove: () => {},
        request: async (_path, options) => {
          if (!options) return { ...head, canUpload: true };
          if (options.fileUri) {
            events.push('upload');
            if (fail) throw new Error(fail);
            const version = { ...old, id: 'new', snapshotHash: signature, completedAt: new Date(time).toISOString() };
            head = { ...head, headId: version.id, versions: [version, ...head.versions] };
            onUpload();
            return version;
          }
          events.push('create'); return { ...old, id: 'new', snapshotHash: signature, status: 'created', completedAt: null };
        },
      });
      return controller;
    },
    finish: async selected => { events.push('finish'); assert.equal(selected.id, shop.id); pending = false; },
  };
  const review = { expected: JSON.stringify(local), shop: existing ? shop : undefined, head: { ...head, versions: [...head.versions] } };
  return { deps, review, shop, events, local: () => local, head: () => head, saved: () => JSON.parse(saved), pending: () => pending,
    change: () => { local = { ...local, shopName: 'Changed after review' }; }, switch: () => { active = false; },
    remoteChange: () => { head = { ...head, epoch: head.epoch + 1 }; }, fail: code => { fail = code; },
    controller: () => controller, advance: ms => { time += ms; }, editAfterUpload: () => { signature = 'd'.repeat(64); },
    onUpload: fn => { onUpload = fn; },
  };
}

test('review reads only this account’s matching shop and makes no upload or ownership changes', async () => {
  const a = setup(), before = JSON.stringify(a.local());
  const result = await reviewLocalPublication({ ...a.deps, shops: async () => [
    { id: 'other', localShopId: 'another-local-shop', name: 'Another shop' }, a.shop,
  ] });
  assert.equal(result.shop.id, a.shop.id); assert.equal(result.expected, before); assert.deepEqual(a.events, []);
  const fresh = await reviewLocalPublication({ ...a.deps, shops: async () => [] });
  assert.equal(fresh.shop, undefined); assert.equal(fresh.head.headId, null);
});

test('an imported local snapshot actually uploads over the reviewed base before enabling ten-minute backups', async () => {
  const a = setup(), original = JSON.stringify(a.local());
  await publishLocalShop(a.deps, a.review);
  assert.deepEqual(a.events, ['pause', 'claim', 'publisher', 'prepare', 'create', 'upload', 'finish']);
  assert.equal(a.saved().enabled, true); assert.equal(a.saved().checkpoint.id, 'new');
  assert.equal(a.head().versions.length, 2); assert.equal(a.head().versions[1].id, 'old');
  assert.equal(JSON.stringify(a.local()), original); assert.equal(a.pending(), false);
  const count = a.events.filter(e => e === 'upload').length;
  await a.controller().check(); assert.equal(a.events.filter(e => e === 'upload').length, count);
  a.advance(600_001); await a.controller().check(); assert.equal(a.events.filter(e => e === 'upload').length, count);
});

test('a first account backup links the restored shop instead of mixing another shop into it', async () => {
  const a = setup(false); await publishLocalShop(a.deps, a.review);
  assert.deepEqual(a.events.slice(0, 3), ['pause', 'link', 'claim']);
  assert.equal(a.head().versions.length, 1); assert.equal(a.saved().enabled, true);
});

test('stale local data or a changed account prevents publishing the reviewed snapshot', async () => {
  for (const mutate of ['change', 'switch']) {
    const a = setup(); a[mutate]();
    await assert.rejects(publishLocalShop(a.deps, a.review)); assert.deepEqual(a.events, []);
  }
  const a = setup(); const begin = a.deps.begin;
  a.deps.begin = async () => { await begin(); a.change(); };
  await assert.rejects(publishLocalShop(a.deps, a.review), /restoreStale/);
  assert.equal(a.events.includes('claim'), false);
});

test('a cloud head changed after review requires review again and is never overwritten', async () => {
  const a = setup(); a.remoteChange();
  await assert.rejects(publishLocalShop(a.deps, a.review), /syncHeadChanged/);
  assert.equal(a.events.includes('claim'), false); assert.equal(a.head().headId, 'old'); assert.equal(a.pending(), true);
});

test('upload failures retain local data and pending metadata without enabling automatic backup', async () => {
  const a = setup(); a.fail('networkUnavailable');
  await assert.rejects(publishLocalShop(a.deps, a.review), /networkUnavailable/);
  assert.equal(a.head().headId, 'old'); assert.equal(a.saved().enabled, false);
  assert.ok(a.saved().upload); assert.equal(a.pending(), true); assert.equal(a.events.includes('finish'), false);
  assert.equal(a.local().shopName, 'Restored shop');
  // The durable publisher can retry the same request without preparing a second archive.
  a.fail(''); await a.controller().check(true);
  assert.equal(a.events.filter(e => e === 'prepare').length, 1); assert.equal(a.saved().checkpoint.id, 'new');
});

test('an invalid activation response or missing base version cannot enable uploads', async () => {
  const a = setup(); a.deps.claim = async () => ({ headId: 'unexpected', epoch: 4 });
  await assert.rejects(publishLocalShop(a.deps, a.review), /invalidResponse/);
  assert.equal(a.events.includes('publisher'), false);
  assert.throws(() => localPublicationSettings('restored', { headId: 'missing', epoch: 1, versions: [] }), /invalidResponse/);
});

test('a failed final account confirmation never reports publication as complete', async () => {
  const a = setup(); a.deps.finish = async () => { throw new Error('networkUnavailable'); };
  await assert.rejects(publishLocalShop(a.deps, a.review), /networkUnavailable/);
  assert.equal(a.pending(), true); assert.equal(a.head().headId, 'new');
  let completed = false;
  await completeLocalPublication({ current: a.deps.current, finish: async () => { completed = true; } }, a.controller(), a.shop);
  assert.equal(completed, true); assert.equal(a.events.filter(e => e === 'upload').length, 1);
});

test('phone edits during upload stay pending and are backed up after the interval', async () => {
  const a = setup(); a.onUpload(() => a.editAfterUpload());
  await publishLocalShop(a.deps, a.review);
  assert.equal(a.saved().checkpoint.signature, 'a'.repeat(64));
  assert.equal(a.controller().snapshot().pending, true);
  await a.controller().check(); assert.equal(a.events.filter(e => e === 'upload').length, 1);
  a.advance(600_001); await a.controller().check();
  assert.equal(a.events.filter(e => e === 'upload').length, 2);
  assert.equal(a.saved().checkpoint.signature, 'd'.repeat(64));
  assert.equal(a.controller().snapshot().pending, false);
});
