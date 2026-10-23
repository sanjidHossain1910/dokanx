import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
function transport({size=4,exists=true,status=200,chunks=[],fetchError,contentLength=String(size)}={}){
  const calls=[],writes=[],bytes=new Uint8Array([80,75,3,4]);
  class File{
    constructor(uri){this.uri=uri;this.type=null;this.size=size;this.exists=exists;}
    async bytes(){return bytes;}
    write(value){writes.push(value);}
  }
  const modules={
    'expo-constants':{expoConfig:{hostUri:'localhost:8081'}},'expo-crypto':{},'expo-secure-store':{},'react-native':{Platform:{OS:'android'}},'expo-file-system':{File},
    './controller':{createAccountController:deps=>deps.api},
    'expo/fetch':{fetch:async(url,options)=>{
      if(fetchError)throw new Error(fetchError);
      // The SDK treats File/Blob as a MIME-bearing body and replaces the supplied header.
      // A .dokanx file reports null on Android, which is invalid for native headers.
      assert.equal(options.body instanceof File,false);
      let at=0;calls.push({url,options});return {ok:status===200,status,headers:{get:()=>contentLength},body:{getReader:()=>({read:async()=>at<chunks.length?{done:false,value:chunks[at++]}:{done:true},cancel:async()=>{}})},json:async()=>status===200?{status:'complete'}:{code:'FST_ERR_CTP_INVALID_MEDIA_TYPE'}};
    }},
  };
  const source=readFileSync(new URL('../src/account/native.ts',import.meta.url),'utf8');
  const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
  const exports={};runInNewContext(outputText,{exports,require:key=>{assert.ok(modules[key],key);return modules[key];},__DEV__:true,process:{env:{EXPO_PUBLIC_API_URL:'http://localhost:3000/api/v1'}},URL,AbortController,setTimeout,clearTimeout,Uint8Array});
  return {api:exports.accountController,calls,bytes,writes};
}
test('custom backup extensions upload exact bytes with an explicit binary content type',async()=>{
  const a=transport();assert.deepEqual(await a.api.request('/backups/shop/version/upload',{fileUri:'file:///cache/backup.dokanx',token:'test-token'}),{status:'complete'});
  assert.deepEqual(a.calls[0].options.body,a.bytes);assert.equal(a.calls[0].options.headers['Content-Type'],'application/octet-stream');assert.equal(a.calls[0].options.headers.Authorization,'Bearer test-token');
});
test('missing and oversized upload files fail before a request is sent',async()=>{
  for(const [options,error] of [[{exists:false},/backupTempMissing/],[{size:60000001},/invalidBackup/]]){const a=transport(options);await assert.rejects(a.api.request('/backups/shop/version/upload',{fileUri:'file:///cache/backup.dokanx'}),error);assert.equal(a.calls.length,0);}
});
test('unsupported binary content types produce an actionable upload error',async()=>{
  const a=transport({status:415});await assert.rejects(a.api.request('/backups/shop/version/upload',{fileUri:'file:///cache/backup.dokanx'}),/backupUploadType/);
});
test('Android native connection failures show a connection error instead of generic backup failure',async()=>{
 const a=transport({fetchError:'fetch failed: java.net.ConnectException: Failed to connect to /192.168.100.114:3000'});
 await assert.rejects(a.api.request('/backups/shop/changes/exchange',{fileUri:'file:///cache/changes.json'}),/networkUnavailable/);
});
test('download progress follows real received bytes and only complete data reaches a file',async()=>{
  const a=transport({chunks:[new Uint8Array([1,2]),new Uint8Array([3,4])]}),progress=[];
  await a.api.request('/backups/shop/version/download',{saveTo:'file:///cache/download.dokanx',expectedBytes:4,onProgress:(received,total)=>progress.push([received,total])});
  assert.deepEqual(progress,[[0,4],[2,4],[4,4]]);assert.deepEqual(a.writes[0],new Uint8Array([1,2,3,4]));
});
test('truncated and oversized downloads never write a usable local archive',async()=>{
  for(const chunks of [[new Uint8Array([1,2])],[new Uint8Array([1,2,3,4,5])]]){const a=transport({chunks});await assert.rejects(a.api.request('/backups/shop/version/download',{saveTo:'file:///cache/download.dokanx',expectedBytes:4}),/invalidBackup/);assert.equal(a.writes.length,0);}
});


test('version metadata supplies download length when Content-Length is missing', async () => {
  const a = transport({ contentLength: null, chunks: [new Uint8Array([1, 2, 3, 4])] });
  await a.api.request('/backups/shop/version/download', { saveTo: 'file:///cache/download.dokanx', expectedBytes: 4 });
  assert.deepEqual(a.writes[0], new Uint8Array([1, 2, 3, 4]));
});
