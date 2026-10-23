import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyBusiness,addProduct,recordSale} from '../src/store/business.ts';
import {addCartProduct,completeSale} from '../src/store/pos.ts';
import {returnSale,settleBalance} from '../src/store/finance.ts';
import {historyRange} from '../src/store/salesHistory.ts';
import {selectLifetimeSummary} from '../src/dashboard/lifetimeSummary.ts';
const stamp='2026-10-20T10:00:00.000Z';
function base(){return {...addProduct(emptyBusiness,{id:'p',name:'Rice',barcode:'',category:'',price:10000,cost:6000,stock:100,unit:'piece'}),customers:[{id:'c',name:'Customer',phone:'',balance:0}]};}
function sale(data,id,quantity,method,received){let cart=addCartProduct(data,'p',id,quantity);cart={...cart,saleDraft:{...cart.saleDraft,customerId:'c'}};return completeSale(cart,id,{method,received,reference:'',note:'',createdAt:stamp});}
test('lifetime totals separate credit sales, actual cash retained after change and later digital collections',()=>{
 let data=sale(base(),'cash-sale',1,'cash',20000);data=sale(data,'due-sale',2,'due',5000);data=settleBalance(data,'customer',{id:'collection',partyId:'c',amount:6000,method:'bkash',reference:'',note:'',createdAt:'2026-10-22T10:00:00.000Z'});data={...data,expenses:[{id:'e',name:'Rent',total:1000,createdAt:stamp}]};
 const total=selectLifetimeSummary(data);assert.equal(total.sales,30000);assert.equal(total.profit,11000);assert.equal(total.cash,15000);assert.equal(total.bkash,6000);assert.equal(total.digital,6000);assert.equal(total.received,21000);assert.equal(total.due,9000);assert.equal(total.sales,total.received+total.due);
});
test('returns reduce sales and profit; cancelling due does not count as a cash refund',()=>{
 let data=sale(base(),'due-sale',2,'due',5000);const line=data.invoices[0].items[0];data=returnSale(data,{id:'r1',invoiceId:'due-sale',items:[{lineId:line.id,quantity:1,restock:true}],method:'cash',note:'Returned',createdAt:stamp});const first=selectLifetimeSummary(data);assert.equal(first.sales,10000);assert.equal(first.profit,4000);assert.equal(first.cash,5000);assert.equal(first.received,5000);assert.equal(first.due,5000);
 data=returnSale(data,{id:'r2',invoiceId:'due-sale',items:[{lineId:line.id,quantity:1,restock:true}],method:'cash',note:'Returned remainder',createdAt:stamp});const last=selectLifetimeSummary(data);assert.equal(last.sales,0);assert.equal(last.profit,0);assert.equal(last.received,0);assert.equal(last.cash,0);assert.equal(last.due,0);
});
test('digital receipts and cash refunds remain separate even when refund method differs',()=>{
 let data=sale(base(),'card-sale',1,'card',10000);data=returnSale(data,{id:'r',invoiceId:'card-sale',items:[{lineId:data.invoices[0].items[0].id,quantity:1,restock:false}],method:'cash',note:'Damaged',createdAt:stamp});const total=selectLifetimeSummary(data);assert.equal(total.digital,10000);assert.equal(total.cash,-10000);assert.equal(total.received,0);assert.equal(total.profit,-6000);
});
test('legacy sales do not invent payment records; opening customer balances stay visible',()=>{
 let data=recordSale(base(),'p',1,'legacy',stamp);data={...data,customers:[{...data.customers[0],balance:7000}]};const total=selectLifetimeSummary(data);assert.equal(total.sales,10000);assert.equal(total.profit,4000);assert.equal(total.untrackedSales,10000);assert.equal(total.received,0);assert.equal(total.due,7000);
});
test('empty totals are zero and all-time history spans every recorded year',()=>{const total=selectLifetimeSummary(emptyBusiness);for(const [key,value] of Object.entries(total))assert.equal(value,key === "margin" ? null : 0);const all=historyRange('all',new Date(),'', '');assert.deepEqual(all,{start:-Infinity,end:Infinity});});

test('net margin uses net sales excluding tax and stays undefined without revenue',()=>{let cart=addCartProduct(base(),'p','taxed',1);cart={...cart,saleDraft:{...cart.saleDraft,taxRate:1000}};const data=completeSale(cart,'taxed',{method:'cash',received:11000,reference:'',note:'',createdAt:stamp});const total=selectLifetimeSummary(data);assert.equal(total.sales,11000);assert.equal(total.netRevenue,10000);assert.equal(total.profit,4000);assert.equal(total.margin,40);const loss=selectLifetimeSummary({...data,expenses:[{id:'loss',name:'Rent',total:6000,createdAt:stamp}]});assert.equal(loss.margin,-20);assert.equal(selectLifetimeSummary(emptyBusiness).margin,null);});
