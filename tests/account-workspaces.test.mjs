import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createWorkspaceRepositories,workspaceDatabaseName} from '../src/store/workspaces.ts';
import {createSQLiteRepository} from '../src/store/sqliteRepository.ts';
import {emptyBusiness} from '../src/store/business.ts';
test('account databases preserve offline data and never share or merge product records',async()=>{
  const databases=new Map(),legacy={...emptyBusiness,shopName:'Offline shop'};
  const make=()=>createWorkspaceRepositories((workspace,name)=>{
    let db=databases.get(name);if(!db){db=new DatabaseSync(':memory:');databases.set(name,db);}
    return createSQLiteRepository(async()=>({execAsync:async sql=>db.exec(sql),runAsync:async(sql,...values)=>db.prepare(sql).run(...values),getFirstAsync:async sql=>db.prepare(sql).get()??null}),async()=>workspace==='offline'?JSON.stringify(legacy):null);
  });
  try{
    const store=make(),a=store.forWorkspace('account:account-a'),b=store.forWorkspace('account:account-b');
    assert.deepEqual(await store.read(),legacy);assert.equal((await a.read()).products.length,0);assert.equal((await b.read()).products.length,0);
    const product={id:'same-product-id',name:'Account A rice',barcode:'',category:'',price:100,cost:70,stock:2};
    await a.write({...emptyBusiness,shopName:'Account A',products:[product]});
    await b.write({...emptyBusiness,shopName:'Account B',products:[{...product,name:'Account B oil',stock:9}]});
    assert.equal((await a.read()).products[0].name,'Account A rice');assert.equal((await b.read()).products[0].stock,9);assert.deepEqual(await store.read(),legacy);
    assert.equal((await make().forWorkspace('account:account-a').read()).shopName,'Account A');assert.equal(databases.size,3);
  }finally{for(const db of databases.values())db.close();}
});
test('untrusted workspace names cannot become filesystem paths',()=>{
  for(const key of ['../other','account:../../other','account:a/b','account:a.db',''])assert.throws(()=>workspaceDatabaseName(key),/invalidWorkspace/);
  assert.equal(workspaceDatabaseName('offline'),'dokanx.db');
});
