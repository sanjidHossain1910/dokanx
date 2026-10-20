import test from 'node:test';
import assert from 'node:assert/strict';
import { createCaptureGuard } from '../src/scanner/captureGuard.ts';
import { createScanFlow } from '../src/scanner/scanFlow.ts';

test('capture waits for camera readiness and prevents concurrent requests', () => {
  const camera = createCaptureGuard();
  assert.equal(camera.begin(), undefined);
  camera.markReady();
  const request = camera.begin();
  assert.notEqual(request, undefined);
  assert.equal(camera.isBusy(), true);
  assert.equal(camera.begin(), undefined);
  assert.equal(camera.finish(request), true);
  assert.notEqual(camera.begin(), undefined);
});

test('unmount or background invalidates capture and decode results', () => {
  const camera = createCaptureGuard();
  camera.markReady();
  const request = camera.begin();
  camera.reset();
  assert.equal(camera.isCurrent(request), false);
  assert.equal(camera.begin(), undefined);
  assert.equal(camera.finish(request), false);
});

test('an old capture cannot unlock a replacement camera capture', () => {
  const camera = createCaptureGuard();
  camera.markReady();
  const previous = camera.begin();
  camera.reset();
  camera.markReady();
  const current = camera.begin();
  assert.equal(camera.finish(previous), false);
  assert.equal(camera.isBusy(), true);
  assert.equal(camera.isCurrent(current), true);
  assert.equal(camera.finish(current), true);
});

test('detection closes the camera before logging and navigating, and keeps the raw data', () => {
  const calls = [];
  const event = { data: ' 0012345678905 ', type: 'ean13', cornerPoints: [{ x: 12, y: 34 }] };
  let accepted;
  const scanner = createScanFlow({
    stopCamera: () => calls.push('camera closed'),
    log: (scan) => { calls.push('logged'); accepted = scan; },
    navigate: (scan) => { calls.push('product opened'); assert.equal(scan, accepted); },
  });
  assert.equal(scanner.accept(event, 'camera'), true);
  assert.deepEqual(calls, ['camera closed', 'logged', 'product opened']);
  assert.equal(accepted.barcode, '0012345678905');
  assert.equal(accepted.received, event);
  assert.equal(accepted.source, 'camera');
  assert.ok(accepted.id);
});

test('blank and duplicate frame events cannot create extra feedback/navigation requests', () => {
  const navigations = [];
  let stops = 0;
  const scanner = createScanFlow({ stopCamera: () => stops++, log: () => {}, navigate: (scan) => navigations.push(scan) });
  assert.equal(scanner.accept({ data: ' ' }, 'camera'), false);
  assert.equal(scanner.hasAccepted(), false);
  assert.equal(scanner.accept({ data: '000123' }, 'photo'), true);
  assert.equal(scanner.accept({ data: '000123' }, 'camera'), false);
  assert.equal(scanner.accept({ data: 'different' }, 'camera'), false);
  assert.equal(stops, 1);
  assert.equal(navigations.length, 1);
  scanner.reset();
  assert.equal(scanner.accept({ data: '000123' }, 'manual'), true);
  assert.notEqual(navigations[0].id, navigations[1].id);
});

test('native scanner result uses the same camera-close and product navigation flow', () => {
  const calls = [];
  const scanner = createScanFlow({
    stopCamera: () => calls.push('stop'),
    log: (scan) => { assert.equal(scan.source, 'native'); assert.equal(scan.received.type, 'ean13'); },
    navigate: (scan) => calls.push(scan.barcode),
  });
  scanner.accept({ data: '6943320882250', type: 'ean13' }, 'native');
  assert.deepEqual(calls, ['stop', '6943320882250']);
  assert.equal(scanner.accept({ data: '6943320882250' }, 'native'), false);
});
