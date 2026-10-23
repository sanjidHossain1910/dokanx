import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {amountVisibilitySettings} from '../src/store/businessSettings.ts';
function fixture(enabled=true,seconds=20){
 const slots=[],effects=[],timers=new Map(),listeners=new Set();let index=0,dirty=false,clock=0,nextId=0,hook;
 const context={data:{businessSettings:{hideAmounts:enabled,amountHideSeconds:seconds}},workspace:'offline',restoreEpoch:0};
 const security={reportsUnlocked:true};let authenticate=async()=>security.reportsUnlocked;
 const requestReports=()=>authenticate();
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
 const react={
  useState(initial){const i=index++;slots[i]??={value:typeof initial==='function'?initial():initial};return[slots[i].value,value=>{const next=typeof value==='function'?value(slots[i].value):value;if(!Object.is(next,slots[i].value)){slots[i].value=next;dirty=true;}}];},
  useRef(initial){const i=index++;return slots[i]??=( {current:initial} );},
  useCallback(fn,deps){const i=index++;if(!slots[i]||!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn;},
  useEffect(fn,deps){const i=index++;if(!slots[i]||!same(slots[i].deps,deps)){const previous=slots[i];slots[i]={deps};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=fn();});}},
 };
 const modules={'react':react,'expo-router':{useFocusEffect:fn=>react.useEffect(fn,[fn])},'react-native':{AppState:{addEventListener:(_event,fn)=>{listeners.add(fn);return{remove:()=>listeners.delete(fn)};}}},'../security/SecurityProvider':{useSecurity:()=>({state:security,requestReports})},'../store/BusinessProvider':{useBusiness:()=>context},'../store/businessSettings':{amountVisibilitySettings}};
 const exports={};const compiled=ts.transpileModule(readFileSync(new URL('../src/dashboard/useAmountVisibility.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(compiled,{exports,require:name=>modules[name],setTimeout:(fn,delay)=>{const id=++nextId;timers.set(id,{fn,at:clock+delay});return id;},clearTimeout:id=>timers.delete(id)});hook=exports.useAmountVisibility;
 function render(){let value;for(let n=0;n<5;n++){dirty=false;index=0;value=hook();while(effects.length)effects.shift()();if(!dirty)return value;}throw new Error('render loop');}
 return{context,security,timers,render,set authenticate(fn){authenticate=fn;},advance(ms){clock+=ms;for(const[id,timer]of [...timers])if(timer.at<=clock){timers.delete(id);timer.fn();}return render();},background(){listeners.forEach(fn=>fn('background'));return render();},inactive(){listeners.forEach(fn=>fn('inactive'));return render();}};
}
test('masking can be disabled; enabled balances hide after the configured timeout and manual hide cancels it',async()=>{const f=fixture(false,60);assert.equal(f.render().visible,true);assert.equal(f.timers.size,0);f.context.data.businessSettings.hideAmounts=true;assert.equal(f.render().visible,false);await f.render().toggle();assert.equal(f.render().visible,true);assert.equal(f.advance(59999).visible,true);assert.equal(f.advance(1).visible,false);await f.render().toggle();await f.render().toggle();assert.equal(f.render().visible,false);assert.equal(f.timers.size,0);});
test('new preferences, workspace changes and backgrounding cancel temporary reveals',async()=>{const f=fixture();await f.render().toggle();assert.equal(f.render().visible,true);f.context.data.businessSettings.amountHideSeconds=30;assert.equal(f.render().visible,false);assert.equal(f.timers.size,0);await f.render().toggle();assert.equal(f.background().visible,false);await f.render().toggle();f.context.workspace='account:another';assert.equal(f.render().visible,false);assert.equal(f.timers.size,0);});
test('turning masking off never bypasses report authentication, and an old unlock cannot reveal a new workspace',async()=>{const f=fixture(false);f.security.reportsUnlocked=false;assert.equal(f.render().visible,false);f.authenticate=async()=>false;await f.render().toggle();assert.equal(f.render().visible,false);f.authenticate=async()=>{f.security.reportsUnlocked=true;return true;};await f.render().toggle();assert.equal(f.render().visible,true);assert.equal(f.timers.size,0);f.security.reportsUnlocked=false;assert.equal(f.render().visible,false);
 f.context.data.businessSettings.hideAmounts=true;let finish;f.authenticate=()=>new Promise(resolve=>finish=resolve);const pending=f.render().toggle();f.context.workspace='account:new';f.render();f.security.reportsUnlocked=true;finish(true);await pending;assert.equal(f.render().visible,false);assert.equal(f.timers.size,0);
});

test('an inactive biometric prompt can finish authentication without requiring a second tap',async()=>{const f=fixture();f.security.reportsUnlocked=false;f.authenticate=async()=>{f.inactive();f.security.reportsUnlocked=true;return true;};await f.render().toggle();assert.equal(f.render().visible,true);assert.equal(f.timers.size,1);});
