import assert from "node:assert/strict";
import test from "node:test";
import { darkTheme, getThemeVariables, lightTheme, resolveThemeMode } from "../src/theme/tokens.ts";

test("an explicit theme always overrides the device appearance", () => {
  assert.equal(resolveThemeMode("light", "dark"), "light");
  assert.equal(resolveThemeMode("dark", "light"), "dark");
});
test("System follows device appearance and has a light fallback", () => {
  assert.equal(resolveThemeMode("system", "dark"), "dark");
  assert.equal(resolveThemeMode("system", "light"), "light");
  assert.equal(resolveThemeMode("system", null), "light");
  assert.equal(resolveThemeMode("system", "unspecified"), "light");
});
test("both palettes cover every surface and provide distinct page, card, text and border colors", () => {
  assert.deepEqual(Object.keys(lightTheme).sort(), Object.keys(darkTheme).sort());
  for (const token of ["background", "card", "elevated", "text", "muted", "border", "primary"]) {
    assert.notEqual(lightTheme[token], darkTheme[token]);
  }
  assert.equal(lightTheme.background, "#F8FAFC");
  assert.equal(darkTheme.background, "#020617");
});
test("server and initial hydration use the same variables before applying saved appearance", () => {
  assert.equal(resolveThemeMode("system", null, false), "light");
  assert.equal(resolveThemeMode("system", "dark", false), "light");
  assert.equal(resolveThemeMode("dark", "dark", false), "light");
  assert.equal(resolveThemeMode("dark", "dark", true), "dark");
});
test("document and screen variables share the full active palette", () => {
  for (const colors of [lightTheme, darkTheme]) {
    const variables = getThemeVariables(colors);
    assert.equal(variables["--app-background"], colors.background);
    assert.equal(variables["--app-card"], colors.card);
    assert.equal(variables["--app-text"], colors.text);
    assert.equal(variables["--app-border"], colors.border);
  }
});
