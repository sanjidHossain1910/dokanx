import test from 'node:test';
import assert from 'node:assert/strict';
import {formatConflictNumber,formatConflictStructure,settlementPresence} from '../src/cloudBackup/conflictPresentation.ts';
import {formatMoney} from '../src/dashboard/format.ts';
test('due balances and allocated payment amounts display currency, while quantities retain their units',()=>{
 for(const language of ['en','bn']){
  assert.equal(formatConflictNumber(150000,'balance',language,'customers/c'),formatMoney(150000,language));
  assert.equal(formatConflictNumber(50000,'allocations.0.amount',language,'customerCollections/p'),formatMoney(50000,language));
  assert.equal(formatConflictNumber(12,'stock',language,'products/p'),(12).toLocaleString(language));
  assert.equal(formatConflictNumber(10,'items.0.counted',language,'stockCounts/c'),(10).toLocaleString(language));
  assert.equal(formatConflictNumber(150000,'counted',language,'cashDays/day'),formatMoney(150000,language));
  const nested=formatConflictStructure([{invoiceId:'invoice',amount:50000}],'allocations',language,'customerCollections/p');assert.equal(nested[0].amount,formatMoney(50000,language));
 }
});
test('two independent payment IDs are presented as source events rather than missing values',()=>{
 const first={id:'phone',amount:50000},second={id:'cloud',amount:150000};
 const local=settlementPresence(first,null,null,true),cloud=settlementPresence(null,second,null,true);
 assert.equal(local.label,'newLocal');assert.equal(local.value.amount,50000);assert.equal(cloud.label,'newCloud');assert.equal(cloud.value.amount,150000);
 assert.equal(settlementPresence(null,second,second,true).label,'deletedLocal');assert.equal(settlementPresence(first,null,first,true).label,'deletedCloud');
 assert.equal(settlementPresence(null,second,undefined,false).label,'cloudCopy');assert.equal(settlementPresence(first,second,null,true),undefined);
});
