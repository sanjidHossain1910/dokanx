import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { localDateInput } from '../src/store/salesHistory.ts';
import { dayKey } from '../src/store/finance.ts';

function fixture(file, platform = 'android') {
  const slots = [], effects = [], motions = [];
  let index = 0, handlers, closed = 0;
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) { const i = index++; slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }; return [slots[i].value, value => { slots[i].value = value; }]; },
    useRef(initial) { const i = index++; return slots[i] ??= { current: initial }; },
    useMemo(fn, deps) { const i = index++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: fn(), deps }; return slots[i].value; },
    useLayoutEffect(fn, deps) { const i = index++; if (!slots[i] || !same(slots[i].deps, deps)) { const previous = slots[i]; slots[i] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const jsx = (type, props) => ({ type, props });
  const motion = (kind, value, config) => ({ start(callback) { motions.push({ kind, value, config, callback }); } });
  const native = {
    Platform: { OS: platform }, Keyboard: { dismiss() {} },
    Animated: { View: 'Animated.View', Value: class { constructor(value) { this.value = value; } setValue(value) { this.value = value; } stopAnimation() {} }, spring: (v, c) => motion('spring', v, c), timing: (v, c) => motion('timing', v, c) },
    PanResponder: { create(value) { handlers = value; return { panHandlers: value }; } },
    ...Object.fromEntries(['KeyboardAvoidingView', 'Modal', 'Pressable', 'ScrollView', 'Text', 'View'].map(name => [name, name])),
  };
  const modules = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': native,
    'react-i18next': { useTranslation: () => ({ t: key => key, i18n: { language: 'en' } }) },
    '@/hooks/useResponsiveLayout': { useResponsiveLayout: () => ({ formMaxWidth: 720 }) },
    '@/src/theme/ThemeProvider': { useTheme: () => ({ colors: {}, isDark: true }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    'react-native-gesture-handler': {
      GestureHandlerRootView: 'GestureHandlerRootView', GestureDetector: 'GestureDetector',
      Gesture: { Pan() {
        handlers = { config: {} };
        const result = {};
        for (const key of ['enabled', 'runOnJS', 'activeOffsetY', 'failOffsetY', 'failOffsetX']) result[key] = value => { handlers.config[key] = value; return result; };
        for (const key of ['onStart', 'onUpdate', 'onEnd', 'onFinalize']) result[key] = callback => { handlers[key] = callback; return result; };
        return result;
      } },
    },
    'lucide-react-native': { X: 'X', CalendarDays: 'CalendarDays', Clock: 'Clock' },
    '@react-native-community/datetimepicker': { __esModule: true, default: 'Picker' },
    '@/src/store/salesHistory': { localDateInput }, '@/src/store/finance': { dayKey },
    '@/components/business/Screen': { useUi: () => ({}), Button: 'Button' },
  };
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(`../components/${file}.tsx`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  runInNewContext(code, { exports, require: name => { assert.ok(modules[name], name); return modules[name]; } });
  const props = { title: 'Sheet', onClose: () => closed++, children: 'Content', label: 'Date', value: '', onChange() {} };
  let tree;
  function render(patch = {}) { Object.assign(props, patch); index = 0; tree = exports.default(props); while (effects.length) effects.shift()(); return tree; }
  function all(type) { const found = []; function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== 'object') return; if (node.type === type) found.push(node); visit(node.props?.children); } visit(tree); return found; }
  return { render, all, motions, get handlers() { return handlers; }, get closed() { return closed; }, unmount() { for (const slot of slots) slot?.cleanup?.(); } };
}

test('native sheet gesture has its own Modal root, downward activation and horizontal rejection; short drags return', () => {
  const f = fixture('business/InventorySheet'); f.render(); const h = f.handlers;
  assert.equal(f.all('GestureHandlerRootView').length, 1);
  assert.equal(f.all('GestureDetector').length, 1);
  const header = f.all('GestureDetector')[0].props.children;
  assert.equal(header.props.collapsable, false);
  assert.equal(h.config.activeOffsetY, 8); assert.equal(h.config.failOffsetY, -8);
  assert.deepEqual([...h.config.failOffsetX], [-24, 24]); assert.equal(h.config.runOnJS, true);
  h.onUpdate({ translationY: 40 });
  const sheet = f.all('Animated.View')[0]; assert.equal(sheet.props.style.transform[0].translateY.value, 40);
  h.onEnd({ translationY: 40, velocityY: 100 }, true);
  assert.equal(f.motions.at(-1).kind, 'spring'); assert.equal(f.closed, 0);
  h.onFinalize(); assert.equal(f.motions.at(-1).config.toValue, 0);
});

test('sheet swipe closes after animation, disables busy saves, and rechecks busy before closing', () => {
  const f = fixture('business/InventorySheet'); f.render({ busy: true });
  assert.equal(f.handlers.config.enabled, false);
  f.render({ busy: false }); f.handlers.onEnd({ translationY: 120, velocityY: 100 }, true);
  assert.equal(f.closed, 0); f.render({ busy: true }); f.motions.at(-1).callback({ finished: true });
  assert.equal(f.closed, 0); assert.equal(f.motions.at(-1).kind, 'spring');
  f.render({ busy: false }); f.handlers.onEnd({ translationY: 30, velocityY: 1000 }, true);
  const complete = f.motions.at(-1).callback;
  const count = f.motions.length; f.handlers.onFinalize(); assert.equal(f.motions.length, count);
  complete({ finished: true }); assert.equal(f.closed, 1);
});

test('cancelled gestures and unmounting during a sheet swipe cannot close the sheet', () => {
  const f = fixture('business/InventorySheet'); f.render();
  f.handlers.onEnd({ translationY: 120, velocityY: 1000 }, false); assert.equal(f.motions.at(-1).kind, 'spring');
  f.handlers.onEnd({ translationY: 120, velocityY: 1000 }, true);
  const complete = f.motions.at(-1).callback; f.unmount(); complete({ finished: false }); assert.equal(f.closed, 0);
});

test('Android date selection saves the local calendar day; dismiss leaves the old value; optional date clears', () => {
  const f = fixture('ui/DateTimeField'), changes = []; f.render({ value: '2026-10-22', clearable: true, onChange: v => changes.push(v) });
  f.all('Pressable')[0].props.onPress(); f.render(); f.all('Picker')[0].props.onDismiss(); f.render();
  assert.equal(f.all('Picker').length, 0); assert.deepEqual(changes, []);
  f.all('Pressable')[0].props.onPress(); f.render(); f.all('Picker')[0].props.onValueChange({}, new Date(2027, 0, 2, 23, 50)); f.render();
  assert.deepEqual(changes, ['2027-01-02']); assert.equal(f.all('Picker').length, 0);
  f.all('Pressable')[1].props.onPress(); assert.equal(changes.at(-1), '');
});

test('iOS date changes remain a draft until Done; Cancel preserves the stored date', () => {
  const f = fixture('ui/DateTimeField', 'ios'), changes = []; f.render({ value: '2026-10-22', onChange: v => changes.push(v) });
  f.all('Pressable')[0].props.onPress(); f.render(); f.all('Picker')[0].props.onValueChange({}, new Date(2028, 1, 29)); f.render();
  assert.deepEqual(changes, []); f.all('Button')[0].props.onPress(); f.render(); assert.deepEqual(changes, []);
  f.all('Pressable')[0].props.onPress(); f.render(); f.all('Picker')[0].props.onValueChange({}, new Date(2028, 1, 29)); f.render();
  f.all('Button')[1].props.onPress(); assert.deepEqual(changes, ['2028-02-29']);
});

test('time mode saves HH:mm and a field becoming disabled cannot commit an open picker', () => {
  const f = fixture('ui/DateTimeField'), changes = []; f.render({ mode: 'time', value: '09:15', onChange: v => changes.push(v) });
  f.all('Pressable')[0].props.onPress(); f.render(); const picker = f.all('Picker')[0];
  assert.equal(picker.props.value.getHours(), 9); assert.equal(picker.props.value.getMinutes(), 15);
  picker.props.onValueChange({}, new Date(2026, 9, 22, 17, 5)); assert.deepEqual(changes, ['17:05']);
  f.render({ disabled: true }); assert.equal(f.all('Picker').length, 0); assert.equal(f.all('Pressable')[0].props.disabled, true);
});
