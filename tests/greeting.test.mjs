import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { localGreeting } from "../src/dashboard/greeting.ts";
test("greeting changes at local morning, afternoon, evening and night boundaries", () => {
  for (const [hour, minute, expected] of [[0,0,"night"],[4,59,"night"],[5,0,"morning"],[11,59,"morning"],[12,0,"afternoon"],[16,59,"afternoon"],[17,0,"evening"],[20,59,"evening"],[21,0,"night"],[23,59,"night"]]) assert.equal(localGreeting(new Date(2026,9,20,hour,minute)), expected);
});
test("the same instant greets according to the device timezone, rather than UTC", () => {
  const script = 'import { localGreeting } from "./src/dashboard/greeting.ts"; process.stdout.write(localGreeting(new Date("2026-10-20T04:00:00Z")));';
  const run = (TZ) => execFileSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--experimental-strip-types", "--input-type=module", "-e", script], { cwd: new URL("..", import.meta.url), env: { ...process.env, TZ }, encoding: "utf8" });
  assert.equal(run("UTC"), "night"); assert.equal(run("Asia/Dhaka"), "morning"); assert.equal(run("Asia/Tokyo"), "afternoon");
});
