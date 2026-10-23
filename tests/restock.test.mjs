import assert from "node:assert/strict";
import test from "node:test";
import { addProduct, emptyBusiness, parseBusiness, recordSale, recordPurchase } from "../src/store/business.ts";
import { suggestRestock } from "../src/restock/engine.ts";
import { beginRestockPurchase, defaultRestockSettings, planTotal, restockData, saveRestockRule, saveRestockSettings, setRestockPlanItem } from "../src/restock/settings.ts";
import { completePurchase, saveSupplier, selectPurchaseSupplier, setPurchaseItem } from "../src/store/purchasing.ts";
import { addCartProduct, completeSale } from "../src/store/pos.ts";
import { returnSale } from "../src/store/finance.ts";
import { decodeBackup, encodeBackup, mapBackupImages } from "../src/store/backupFormat.ts";
import { buildPredictionSnapshot, requestPrediction, validRemotePrediction } from "../src/restock/prediction.ts";

const now = new Date(2026, 9, 20, 14), stamp = (offset, hour=10) => new Date(2026, 9, 20+offset, hour).toISOString();
function history({id="rice",unit="kg",days=30,daily=5,stock=12,cost=7000}={}) {
  let data=addProduct(emptyBusiness,{id,name:id,barcode:"",category:"",unit,stock:stock+days*daily,cost,price:10000,createdAt:stamp(-days,0)});
  for(let i=days;i>=1;i--)data=recordSale(data,id,daily,`${id}-${i}`,stamp(-i));
  return data;
}
const only = (data,settings) => suggestRestock(data,now,settings)[0];
const supplier={id:"supplier",name:"Supplier",phone:"",address:"",balance:0};

test("uses quantities, complete local days and safety/lead time without mutating shop data",()=>{
  const data=history(), before=JSON.stringify(data), r=only(data);
  assert.equal(r.rate,5);assert.equal(r.sold,150);assert.equal(r.availableDays,30);assert.equal(r.quantity,38);assert.equal(r.daysLeft,2.4);assert.equal(r.confidence,"high");
  assert.equal(JSON.stringify(data),before);
  const today=recordSale(data,"rice",2,"today",stamp(0));
  assert.equal(only(today).rate,5);assert.equal(only(today).quantity,40);assert.equal(only(today).todaySold,2);
});
test("zero-stock days do not lower observed demand and insufficient history remains manual",()=>{
  let data=addProduct(emptyBusiness,{id:"p",name:"p",barcode:"",category:"",stock:35,cost:100,price:200,createdAt:stamp(-30,0)});
  for(let i=30;i>=24;i--)data=recordSale(data,"p",5,`s${i}`,stamp(-i));
  const r=only(data);assert.equal(r.availableDays,7);assert.equal(r.stockoutDays,23);assert.equal(r.rate,5);assert.equal(r.quantity,50);assert.ok(r.warnings.includes("stockouts"));
  const fresh=history({days:2});assert.equal(only(fresh).quantity,null);assert.equal(only(fresh).confidence,"low");
});
test("deduplicates sale rows and never counts invoice snapshots as additional sales",()=>{
  const data=history(); const duplicated={...data,sales:[...data.sales,data.sales[0]],invoices:[{id:"ignored",items:[{productId:"rice",quantity:999}]}]};
  assert.equal(only(duplicated).sold,150);assert.equal(only(duplicated).rate,5);
});
test("POS movements are not applied twice and returns reduce their original sale demand",()=>{
  let data=addProduct(emptyBusiness,{id:"p",name:"p",barcode:"",category:"",unit:"piece",stock:10,cost:100,price:200,createdAt:stamp(-10,0)});
  data=completeSale(addCartProduct(data,"p","invoice",2),"invoice",{method:"cash",received:400,note:"",reference:"",createdAt:stamp(-5)});
  const id=data.invoices[0].items[0].id;
  data=returnSale(data,{id:"return",invoiceId:"invoice",items:[{lineId:id,quantity:1,restock:true}],method:"cash",note:"Return review",createdAt:stamp(-1)});
  assert.equal(only(data).sold,1);assert.equal(only(data).availableDays,10);assert.equal(only(data).warnings.includes("incomplete"),false);
  assert.deepEqual(parseBusiness(JSON.stringify(data)),JSON.parse(JSON.stringify(data)));
});
test("pending orders reduce purchase quantity; draft items are not treated as orders",()=>{
  let data=saveSupplier(history(),supplier);data=setPurchaseItem(selectPurchaseSupplier(data,supplier.id,"order"),"rice",10,7000);
  assert.equal(only(data).incoming,0);assert.equal(only(data).draftQuantity,10);
  data=completePurchase(data,"order",{paid:0,method:"cash",status:"pending",reference:"",note:"",createdAt:stamp(-1)});
  assert.equal(only(data).incoming,10);assert.equal(only(data).quantity,28);assert.ok(only(data).warnings.includes("pending"));
});
test("received purchase movement and purchase row are not double counted",()=>{
  let data=saveSupplier(history(),supplier);data=setPurchaseItem(selectPurchaseSupplier(data,supplier.id,"received"),"rice",10,7000);
  data=completePurchase(data,"received",{paid:0,method:"cash",status:"received",reference:"",note:"",createdAt:stamp(-1)});
  const r=only(data);assert.equal(r.availableDays,30);assert.equal(r.quantity,28);assert.equal(r.incoming,0);assert.equal(r.warnings.includes("incomplete"),false);
});
test("expiry, shelf life, pack size and maximum order constrain quantities",()=>{
  let data=history({stock:12});data={...data,productBatches:[{id:"b",productId:"rice",batchNumber:"b",quantity:5,expiryDate:"2026-10-19",createdAt:stamp(-15)}]};
  assert.equal(only(data).stock,7);assert.equal(only(data).quantity,43);
  data=saveRestockRule(data,{productId:"rice",unit:"kg",packSize:2,shelfLifeDays:4,maxOrder:11});
  const r=only(data);assert.equal(r.quantity,10);assert.ok(r.warnings.includes("shelfCap"));assert.ok(r.warnings.includes("maxCap"));
});
test("budget prioritises stockouts, fits pack multiples and avoids unknown purchase costs",()=>{
  const a=history({id:"a",unit:"piece",stock:0,cost:100}),b=history({id:"b",unit:"piece",stock:12,cost:100});
  let data={...a,products:[...a.products,...b.products],sales:[...a.sales,...b.sales]};
  data=saveRestockSettings(data,{...defaultRestockSettings,budget:1500});
  const rows=suggestRestock(data,now);assert.equal(rows[0].product.id,"a");assert.equal(rows[0].quantity,15);assert.equal(rows[1].quantity,0);
  assert.ok(rows.every(r=>r.warnings.includes("budgetCap")));
  data={...data,products:data.products.map(p=>({...p,cost:0}))};assert.ok(suggestRestock(data,now).every(r=>r.quantity===0&&r.warnings.includes("unknownCost")));
});
test("rising demand is bounded and zero recent sales do not create false confidence",()=>{
  let data=addProduct(emptyBusiness,{id:"p",name:"p",barcode:"",category:"",stock:500,cost:100,price:200,createdAt:stamp(-30,0)});
  for(let i=30;i>=1;i--)data=recordSale(data,"p",i<=7?2:1,`s${i}`,stamp(-i));
  const r=only(data);assert.equal(r.trend,1);assert.ok(r.rate>r.baseRate&&r.rate<=r.baseRate*1.5);
  const none={...data,sales:[]};assert.equal(only(none).quantity,null);
});
test("deleted products, different units and future activity cannot pollute demand",()=>{
  const data=history();const future={...data,sales:[...data.sales,{...data.sales[0],id:"future",quantity:999,createdAt:stamp(1)}]};assert.equal(only(future).rate,5);
  const changed={...data,products:data.products.map(p=>({...p,unit:"piece"}))};assert.equal(only(changed).quantity,null);assert.ok(only(changed).warnings.includes("unitChanged"));
  assert.deepEqual(suggestRestock({...data,products:data.products.map(p=>({...p,deletedAt:stamp(0)}))},now),[]);
});
test("all fractional unit groups preserve thousandth precision while count quantities remain integral",()=>{
  for(const unit of ["kg","litre","metre","square-foot","hour","piece","box"]){
    const data=history({unit,daily:unit==="piece"||unit==="box"?1:0.125,stock:0});const r=only(data);
    if(unit==="hour"){assert.equal(r.quantity,null);continue;}
    assert.equal(r.quantity,unit==="piece"||unit==="box"?10:1.25);
  }
});
test("settings, rules and manually edited quantities persist and survive portable image mapping",()=>{
  let data=history();data=saveRestockSettings(data,{...defaultRestockSettings,targetDays:14});data=saveRestockRule(data,{productId:"rice",unit:"kg",packSize:0.5,leadDays:4});
  data=setRestockPlanItem(data,"rice",7.125,"kg");data=saveRestockSettings(data,{...defaultRestockSettings,targetDays:3});
  const restored=parseBusiness(JSON.stringify(data));assert.equal(restored.restock.plan[0].quantity,7.125);assert.deepEqual(mapBackupImages(restored,u=>u).restock,data.restock);
  assert.equal(planTotal(data),49875);assert.equal(restockData(emptyBusiness).plan.length,0);
  const manifest={format:"DokanX",version:1,createdAt:now.toISOString(),data,assets:[]};
  assert.deepEqual(decodeBackup(encodeBackup(manifest,{})).manifest.data.restock,data.restock);
});
test("corrupted planning payloads are rejected and old shop data still loads",()=>{
  const data=saveRestockSettings(history(),{...defaultRestockSettings});
  for(const mutate of [r=>r.settings.targetDays=0,r=>r.settings.budget=-1,r=>r.rules=[{productId:"rice",unit:"kg",packSize:0}],r=>r.plan=[{productId:"missing",unit:"piece",quantity:1}],r=>r.plan=[{productId:"rice",unit:"piece",quantity:0.5}]]){
    const next=structuredClone(data);mutate(next.restock);assert.throws(()=>parseBusiness(JSON.stringify(next)),/invalidData/);
  }
  assert.deepEqual(parseBusiness(JSON.stringify(emptyBusiness)),emptyBusiness);
});
test("purchase hand-off is atomic, preserves other list items and refuses draft replacement or stale plans",()=>{
  let data=saveSupplier(history(),supplier);data=addProduct(data,{id:"other",name:"other",barcode:"",category:"",stock:1,cost:100,price:200});
  data=setRestockPlanItem(setRestockPlanItem(data,"rice",3.5,"kg"),"other",2,"piece");const expected=JSON.stringify(data.restock.plan),snapshot=JSON.stringify(data);
  const next=beginRestockPurchase(data,supplier.id,"draft",expected,["rice"]);
  assert.equal(next.purchaseDraft.lines[0].quantity,3.5);assert.equal(next.restock.plan[0].productId,"other");assert.equal(next.products[0].stock,12);assert.equal(JSON.stringify(data),snapshot);
  assert.throws(()=>beginRestockPurchase(next,supplier.id,"new",JSON.stringify(next.restock.plan)),/draftExists/);
  assert.throws(()=>beginRestockPurchase(data,supplier.id,"new","stale"),/planChanged/);
  assert.throws(()=>beginRestockPurchase({...data,products:data.products.map(p=>p.id==="rice"?{...p,unit:"piece"}:p)},supplier.id,"new",expected),/productChanged/);
  assert.deepEqual(parseBusiness(JSON.stringify(next)),JSON.parse(JSON.stringify(next)));
});
test("stale plan units remain readable and removable after editing a product",()=>{
  const data=setRestockPlanItem(history(),"rice",3.5,"kg");const changed={...data,products:data.products.map(p=>({...p,unit:"piece"}))};
  assert.equal(parseBusiness(JSON.stringify(changed)).restock.plan[0].unit,"kg");assert.equal(planTotal(changed),null);
  assert.equal(setRestockPlanItem(changed,"rice",0,"kg").restock.plan.length,0);
});
test("prediction snapshot excludes private fields and its revision changes only with forecast inputs",()=>{
  const data={...history(),shopName:"PRIVATE SHOP",shopPhone:"01712345678",ownerName:"PRIVATE OWNER",customers:[{id:"c",name:"PRIVATE CUSTOMER",phone:"01812345678"}]};
  const a=buildPredictionSnapshot(data,now);const text=JSON.stringify(a);
  for(const secret of ["PRIVATE SHOP","01712345678","PRIVATE OWNER","PRIVATE CUSTOMER","01812345678"])assert.equal(text.includes(secret),false);
  assert.equal(buildPredictionSnapshot(setRestockPlanItem(data,"rice",3,"kg"),now).fingerprint,a.fingerprint);
  assert.notEqual(buildPredictionSnapshot(recordSale(data,"rice",1,"today",stamp(0)),now).fingerprint,a.fingerprint);
});
test("future AI responses require current inputs, correct units, safe quantities and expiry",()=>{
  const data=history(),rows=suggestRestock(data,now),snapshot=buildPredictionSnapshot(data,now,rows);
  const good={version:1,source:"ai",fingerprint:snapshot.fingerprint,generatedAt:now.toISOString(),expiresAt:new Date(now.getTime()+60000).toISOString(),items:[{productId:"rice",unit:"kg",quantity:42,explanation:"Review recent demand"}]};
  assert.equal(validRemotePrediction(good,snapshot,rows,now),true);
  for(const value of [{...good,fingerprint:"stale"},{...good,expiresAt:stamp(-1)},{...good,items:[{...good.items[0],unit:"piece"}]},{...good,items:[{...good.items[0],quantity:99999}]},{...good,items:[good.items[0],good.items[0]]}])assert.equal(validRemotePrediction(value,snapshot,rows,now),false);
});
test("future provider failure, missing adapter, timeout and invalid output all preserve local prediction",async()=>{
  const data=history(),rows=suggestRestock(data,now),snapshot=buildPredictionSnapshot(data,now,rows);
  assert.equal((await requestPrediction(snapshot,rows)).source,"device");
  assert.equal((await requestPrediction(snapshot,rows,{predict:async()=>{throw new Error("offline");}})).source,"device");
  assert.equal((await requestPrediction(snapshot,rows,{predict:()=>new Promise(()=>{})},{timeoutMs:5})).source,"device");
  assert.equal((await requestPrediction(snapshot,rows,{predict:async()=>({})})).source,"device");
  assert.equal(only(data).quantity,38);
});

test("future AI success remains explicit; stale input revisions and cancellation return local results",async()=>{
  const data=history(),rows=suggestRestock(data,now),snapshot=buildPredictionSnapshot(data,now,rows);
  const response={version:1,source:"ai",fingerprint:snapshot.fingerprint,generatedAt:now.toISOString(),expiresAt:new Date(now.getTime()+60000).toISOString(),items:[{productId:"rice",unit:"kg",quantity:42,explanation:"Compare recent demand"}]};
  const provider={predict:async()=>response};
  assert.equal((await requestPrediction(snapshot,rows,provider,{now:()=>now})).source,"ai");
  const stale=await requestPrediction(snapshot,rows,provider,{now:()=>now,currentFingerprint:()=>"changed"});assert.equal(stale.source,"device");assert.equal(stale.reason,"stale");
  const abort=new AbortController();const pending=requestPrediction(snapshot,rows,{predict:()=>new Promise(()=>{})},{signal:abort.signal,timeoutMs:1000});abort.abort();
  assert.equal((await pending).source,"device");
  assert.equal(data.restock,undefined);
});

test("rule edits never change an existing manual quantity; invalid saves leave data intact",()=>{
  let data=setRestockPlanItem(history(),"rice",4.375,"kg");const before=JSON.stringify(data);
  assert.throws(()=>saveRestockSettings(data,{...defaultRestockSettings,leadDays:-1}),/invalidSettings/);
  assert.throws(()=>saveRestockRule(data,{productId:"rice",unit:"piece",packSize:1}),/invalidRule/);assert.equal(JSON.stringify(data),before);
  data=saveRestockRule(data,{productId:"rice",unit:"kg",packSize:10,maxOrder:10});assert.equal(data.restock.plan[0].quantity,4.375);
  assert.equal(only(data).quantity,10);
});

test("legacy purchase changes are counted once and old unit history outside the window is ignored",()=>{
  let data=recordPurchase(history(),{id:"legacy-purchase",productId:"rice",quantity:10,unitCost:7000,unit:"kg",createdAt:stamp(-1)});
  data={...data,sales:[...data.sales,{id:"old-unit",productId:"rice",name:"rice",unit:"piece",quantity:1,total:1,cost:1,createdAt:stamp(-100)}]};
  assert.equal(only(data).quantity,28);assert.equal(only(data).warnings.includes("unitChanged"),false);
});

test("partial stockouts are labelled as limited demand evidence, not high confidence",()=>{
  const r=only(history({stock:0}));assert.equal(r.quantity,50);assert.equal(r.confidence,"medium");assert.ok(r.warnings.includes("partialStockouts"));
});

test("large catalogs are evaluated together without cross-product unit mixing",()=>{
  const products=Array.from({length:1000},(_,i)=>({id:`p-${i}`,name:`Product ${i}`,barcode:"",category:"",stock:0,cost:100,price:200,unit:i%2?"kg":"piece",createdAt:stamp(-30,0)}));
  const sales=products.flatMap(p=>Array.from({length:30},(_,i)=>({id:`${p.id}-${i}`,productId:p.id,name:p.name,unit:p.unit,quantity:1,total:200,cost:100,createdAt:stamp(-i-1)})));
  const rows=suggestRestock({...emptyBusiness,products,sales},now);
  assert.equal(rows.length,1000);assert.ok(rows.every(r=>r.sold===30&&r.quantity===10));
});
