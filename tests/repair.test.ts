import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
import {requestContext,database,env} from './runtime.mjs';
import {GET,POST,PATCH} from '../app/api/v1/[...path]/route';
import {blank} from '../lib/shared';
import {validateImage} from '../lib/image-validation';
const settings=env as typeof env & {ADMIN_BOOTSTRAP_EMAIL?:string};
let sequence=0;
async function call(path:string,method='GET',body?:unknown,as?:string){requestContext(as?{'oai-authenticated-user-id':as}:{});const r=await (method==='GET'?GET:method==='PATCH'?PATCH:POST)(new Request('https://test.local/api/v1/'+path,{method,headers:{Origin:'https://test.local','cf-connecting-ip':'repair-'+(++sequence)},body:body===undefined?undefined:JSON.stringify(body)}));return {status:r.status,data:await r.json() as any};}

test('Počáteční správce: pouze ověřená serverem určená Supabase identita, právě jednou',async()=>{
 settings.ADMIN_BOOTSTRAP_EMAIL='owner@example.test';
 assert.equal((await call('me','GET',undefined,'stranger')).data.user.role,'author');
 const owner=(await call('me','GET',undefined,'owner')).data.user;assert.equal(owner.role,'admin');
 assert.equal(database.prepare("SELECT count(*) AS n FROM audit WHERE action='bootstrap-admin'").get()?.n,1);
 settings.ADMIN_BOOTSTRAP_EMAIL='stranger@example.test';
 assert.equal((await call('me','GET',undefined,'stranger')).data.user.role,'author');
 delete settings.ADMIN_BOOTSTRAP_EMAIL;
});

test('Moderátorské pozastavení ani archivaci nelze obejít obnovením a uložením',async()=>{
 await call('me','GET',undefined,'author');
 database.prepare('INSERT INTO uploads VALUES(?,?,?,?,?)').run('repair-image','supabase:author','image/png',100,new Date().toISOString());
 const data={...blank,title:'Regresní projekt',summary:'Představení regresního projektu.',description:'Dostatečně dlouhý popis skutečného testovacího projektu.',purpose:'Ověření bezpečného schvalování.',image:'/api/v1/media/repair-image',recipient:'Testovací příjemce',account:'19-2000145399/0800'};
 const id=(await call('my','POST',data,'author')).data.id;
 async function project(){return (await call('my/'+id,'GET',undefined,'author')).data.project;}
 async function approve(){await call('my/'+id+'/submit','POST',{},'author');const p=await project();assert.equal((await call('admin/projects','POST',{id,version:p.version,action:'approve'},'owner')).status,200);}
 await approve();const slug=(await project()).slug;
 for(const action of ['pause','archive']){
  const p=await project();assert.equal((await call('admin/projects','POST',{id,version:p.version,action,note:'Moderátorský zásah'},'owner')).status,200);
  assert.equal((await call('projects/'+slug)).status,404);
  assert.equal((await call('my/'+id+'/restore','POST',{},'author')).status,200);
  const restored=await project();assert.equal(restored.published,null);
  assert.equal((await call('my/'+id,'PATCH',{version:restored.version,data},'author')).status,200);
  assert.equal((await call('projects/'+slug)).status,404);
  assert.equal((await call('projects/'+id+'/qr','POST',{})).status,409);
  await approve();assert.equal((await call('projects/'+slug)).status,200);
 }
 assert.equal((await call('my/'+id+'/restore','POST',{},'author')).status,409);
});

test('Obrázky: kompletní PNG/WebP, CRC, rozměry, truncation a zákaz falešné hlavičky',()=>{
 const png=new Uint8Array(PNG.sync.write(new PNG({width:2,height:3})));
 assert.deepEqual(validateImage(png),{mime:'image/png',width:2,height:3});
 assert.throws(()=>validateImage(new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])));
 const corrupt=png.slice();corrupt[29]^=1;assert.throws(()=>validateImage(corrupt));
 assert.throws(()=>validateImage(png.slice(0,-1)));
 assert.throws(()=>validateImage(new Uint8Array(PNG.sync.write(new PNG({width:8193,height:1})))));
 const webp=new Uint8Array(readFileSync(new URL('../public/images/hero-collage-v2.webp',import.meta.url)));
 assert.equal(validateImage(webp).mime,'image/webp');assert.throws(()=>validateImage(webp.slice(0,-8)));
});

test('Administrace: stránkování a hledání na serveru, podrobnosti uživatele, neaktivní pošta',async()=>{
 for(let i=0;i<30;i++)database.prepare('INSERT INTO users(id,email,name,created) VALUES(?,?,?,?)').run('supabase:page-'+i,'page'+i+'@example.test','Autor '+i,new Date().toISOString());
 const first=await call('admin/users?page=1','GET',undefined,'owner');assert.equal(first.status,200);assert.equal(first.data.users.length,25);assert.ok(first.data.total>=30);
 const last=await call('admin/users?page=2','GET',undefined,'owner');assert.ok(last.data.users.length>0);assert.equal(new Set([...first.data.users,...last.data.users].map((u:any)=>u.id)).size,first.data.total);
 const search=await call('admin/users?q=page29%40example.test','GET',undefined,'owner');assert.equal(search.data.users.length,1);
 const detail=await call('admin/user?id=supabase%3Aauthor','GET',undefined,'owner');assert.equal(detail.data.user.projects.length,1);
 assert.equal((await call('admin/user?id=supabase%3Aauthor','GET',undefined,'author')).status,403);
 const notifications=await call('admin/notifications','GET',undefined,'owner');assert.equal(notifications.data.enabled,false);
 assert.equal((await call('admin/notifications','POST',{id:'anything'},'owner')).status,503);
});
