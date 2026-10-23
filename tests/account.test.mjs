import test from "node:test";
import assert from "node:assert/strict";
import { createAccountController, validSession } from "../src/account/controller.ts";

const session = { user: { id: "user", phone: "+8801712345678" }, sessionId: "session", accessToken: "a".repeat(43), refreshToken: "b".repeat(43), accessExpiresAt: "2026-10-22T12:00:00Z", refreshExpiresAt: "2026-11-22T12:00:00Z" };
function setup(saved = null) {
  const calls = [], writes = []; let handler = async () => { throw new Error("networkUnavailable"); };
  const controller = createAccountController({ read: async () => saved, write: async (value) => { writes.push(value); }, device: async () => "device", deviceName: "Phone", now: () => Date.parse("2026-10-21T12:00:00Z"), api: { request: async (path, options) => { calls.push({ path, options }); return handler(path, options); } } });
  return { controller, calls, writes, respond: (next) => { handler = next; } };
}
test("offline startup and cached account loading never contact the server", async () => {
  const a = setup(); await a.controller.load(); assert.equal(a.controller.snapshot().ready,true); assert.equal(a.controller.snapshot().session,null); assert.equal(a.calls.length,0);
  const b = setup(JSON.stringify(session)); await b.controller.load(); assert.equal(b.controller.snapshot().session.user.id,"user"); assert.equal(b.calls.length,0);
});
test("invalid saved credentials do not block offline startup or silently authorize a user",async()=>{
  const a=setup('{broken');await a.controller.load();assert.equal(a.controller.snapshot().ready,true);assert.equal(a.controller.snapshot().storageError,true);assert.equal(a.controller.snapshot().session,null);
  assert.equal(validSession({...session,accessToken:"bad"}),false);
});
test("verifies account before storing credentials and never links a shop automatically",async()=>{
  const a=setup();await a.controller.load();a.respond(async()=>session);
  await a.controller.verify("challenge","123456");assert.equal(a.calls[0].path,"/auth/otp/verify");assert.equal(a.calls.length,1);assert.deepEqual(JSON.parse(a.writes[0]),{...session,needsSync:true});assert.equal(a.controller.snapshot().session.binding,undefined);
});
test("sends the chosen signup or login intent for phone verification",async()=>{
  for(const intent of ["signup","login"]){
    const a=setup();await a.controller.load();a.respond(async()=>session);
    await a.controller.verify("challenge","123456",intent);
    assert.equal(a.calls[0].options.body.intent,intent);
  }
});
test("server failures preserve a cached account; offline logout clears only cloud credentials",async()=>{
  const a=setup(JSON.stringify(session));await a.controller.load();await assert.rejects(a.controller.refreshProfile(),/networkUnavailable/);assert.ok(a.controller.snapshot().session);
  assert.deepEqual(await a.controller.logout(),{revoked:false});assert.equal(a.controller.snapshot().session,null);assert.equal(a.writes.at(-1),null);
});
test("explicit shop linking persists an owner-returned binding without business data upload",async()=>{
  const a=setup(JSON.stringify(session));await a.controller.load();a.respond(async()=>({id:"cloud-shop",localShopId:"local",name:"Shop"}));await a.controller.linkShop("local","Shop");
  assert.deepEqual(a.calls[0].options.body,{localShopId:"local",name:"Shop"});assert.equal(a.controller.snapshot().session.binding.id,"cloud-shop");
});
test("expired access rotates credentials before using account APIs; revocation clears the session",async()=>{
  const a=setup(JSON.stringify({...session,accessExpiresAt:"2026-10-20T12:00:00Z"}));await a.controller.load();a.respond(async(path)=>path==="/auth/refresh"?{...session,accessToken:"c".repeat(43)}:session.user);await a.controller.refreshProfile();assert.deepEqual(a.calls.map(c=>c.path),["/auth/refresh","/auth/me"]);assert.equal(a.calls[1].options.token,"c".repeat(43));
  a.respond(async()=>{throw new Error("unauthorized")});await assert.rejects(a.controller.refreshProfile(),/unauthorized/);assert.equal(a.controller.snapshot().session,null);
});
test("concurrent account actions do not rotate tokens twice",async()=>{
  const a=setup(JSON.stringify(session));await a.controller.load();let done;a.respond(()=>new Promise(resolve=>{done=resolve}));const active=a.controller.refreshProfile();await assert.rejects(a.controller.refreshProfile(),/accountBusy/);done(session.user);await active;assert.equal(a.calls.length,1);
});
test("startup loads once so a late second read cannot overwrite a newer login",async()=>{
  let reads=0;const a=createAccountController({read:async()=>{reads++;return null},write:async()=>{},device:async()=>"device",deviceName:"Phone",api:{request:async()=>session}});
  await Promise.all([a.load(),a.load()]);await a.verify("challenge","123456");await a.load();assert.equal(reads,1);assert.equal(a.snapshot().session.user.id,"user");
});
test("failed secure persistence does not report successful login",async()=>{
  const a=createAccountController({read:async()=>null,write:async()=>{throw new Error("keystore")},device:async()=>"device",deviceName:"Phone",api:{request:async()=>session}});await a.load();await assert.rejects(a.verify("challenge","123456"),/accountStorage/);assert.equal(a.snapshot().session,null);assert.equal(a.snapshot().storageError,true);
});
test('Sync stays pending through token refresh and only a server-owned shop can finish it',async()=>{
  const a=setup(JSON.stringify({...session,accessExpiresAt:'2026-10-20T12:00:00Z'}));await a.controller.load();await a.controller.beginSync();assert.equal(a.controller.snapshot().session.needsSync,true);
  a.respond(async path=>path==='/auth/refresh'?session:{shops:[{id:'owned',localShopId:'local',name:'My shop'}]});
  await assert.rejects(a.controller.completeSync('other'),/invalidResponse/);assert.equal(a.controller.snapshot().session.needsSync,true);
  await a.controller.completeSync('owned');assert.equal(a.controller.snapshot().session.needsSync,false);assert.equal(a.controller.snapshot().session.binding.id,'owned');
});

test('OTP requests carry login/signup intent and an unknown login never returns a challenge or saves credentials',async()=>{
 for(const intent of ['login','signup']){const a=setup();await a.controller.load();a.respond(async()=>({challengeId:'c',phone:'+8801712345678',expiresAt:'2026-10-22T12:05:00Z',retryAfterSeconds:60,delivery:'development'}));const challenge=await a.controller.requestCode('01712345678',intent);assert.equal(challenge.challengeId,'c');assert.deepEqual(a.calls[0].options.body,{phone:'01712345678',intent});assert.equal(a.writes.length,0);}
 const a=setup();await a.controller.load();a.respond(async()=>{throw new Error('accountNotFound');});await assert.rejects(a.controller.requestCode('01912345678'),/accountNotFound/);assert.equal(a.calls[0].options.body.intent,'login');assert.equal(a.controller.snapshot().busy,false);assert.equal(a.controller.snapshot().session,null);assert.equal(a.writes.length,0);
});
