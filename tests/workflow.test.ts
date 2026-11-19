import {test} from 'node:test';import assert from 'node:assert/strict';
import {requestContext,database,env} from './runtime.mjs';
import {GET,POST,PATCH} from '../app/api/v1/[...path]/route';
import {blank} from '../lib/shared';
const origin='https://test.local';let checks=0;
async function call(path:string,method='GET',body?:any,as?:string,raw?:Uint8Array,originOverride?:string){const h:any={'Origin':originOverride||origin,'cf-connecting-ip':'test-'+(++checks)};if(as){h['oai-authenticated-user-id']=as;h['oai-authenticated-user-email']=as+'@example.test';}requestContext(h);const req=new Request(origin+'/api/v1/'+path,{method,headers:h,body:raw?new Blob([raw as Uint8Array<ArrayBuffer>]):body===undefined?undefined:JSON.stringify(body)});const res=await (method==='GET'?GET:method==='PATCH'?PATCH:POST)(req);const ct=res.headers.get('Content-Type')||'';const d:any=ct.includes('json')?await res.json():null;return {status:res.status,data:d};}
test('Dva autoři, anonymní návštěvník a správce: celý životní cyklus a ochrana dat',async()=>{
 assert.equal((await call('my')).status,401);await call('me','GET',undefined,'alice');await call('me','GET',undefined,'bob');await call('me','GET',undefined,'admin');database.prepare("UPDATE users SET role='admin' WHERE id='supabase:admin'").run();
 assert.equal((await call('admin/projects','GET',undefined,'alice')).status,403);
 assert.equal((await call('my','POST',{...blank,title:'Cizí původ'},'alice',undefined,'https://evil.test')).status,403);
 const file=await call('uploads','POST',undefined,'alice',new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]));assert.equal(file.status,201);
 const data={...blank,title:'Skutečný test projektu',summary:'Dostatečně dlouhé představení projektu.',description:'Toto je delší popis testovacího projektu pro ověření schvalování a veřejné verze.',purpose:'Podpora dalšího vývoje a provozu.',image:file.data.url,account:'19-2000145399/0800',recipient:'Testovací příjemce'};
 const created=await call('my','POST',data,'alice');assert.equal(created.status,201);const pid=created.data.id;let detail=await call('my/'+pid,'GET',undefined,'alice');const slug=detail.data.project.slug;
 assert.equal((await call('my/'+pid,'GET',undefined,'bob')).status,403);assert.equal((await call('media/'+file.data.url.split('/').pop())).status,404);assert.equal((await call('projects/'+slug)).status,404);
 assert.equal((await call('my','POST',data,'bob')).status,403); // cannot steal Alice's upload
 assert.equal((await call('my/'+pid+'/submit','POST',{},'alice')).status,200);
 assert.equal((await call('admin/projects','POST',{id:pid,action:'approve'},'alice')).status,403);
 let adminProject=(await call('my/'+pid,'GET',undefined,'alice')).data.project;
 assert.equal((await call('admin/projects','POST',{id:pid,action:'approve',version:adminProject.version-1},'admin')).status,409);
 assert.equal((await call('admin/projects','POST',{id:pid,action:'approve',version:adminProject.version},'admin')).status,200);
 const publicData=await call('projects/'+slug);assert.equal(publicData.status,200);assert.equal(publicData.data.project.title,data.title);assert.equal(publicData.data.project.draft,undefined);assert.equal(publicData.data.project.author.email,undefined);
 assert.equal((await call('media/'+file.data.url.split('/').pop())).status,200);
 const qr=await call('projects/'+pid+'/qr','POST',{amount:'150,25'});assert.equal(qr.status,200);assert.match(qr.data.payload,/AM:150.25/);assert.equal((await call('projects/'+pid+'/qr','POST',{amount:'-1'})).status,400);
 detail=await call('my/'+pid,'GET',undefined,'alice');let version=detail.data.project.version;
 assert.equal((await call('my/'+pid,'PATCH',{version,data:{...data,title:'Nový neveřejný název'}},'alice')).status,200);
 assert.equal((await call('projects/'+slug)).data.project.title,data.title);assert.equal((await call('projects/'+pid+'/qr','POST',{})).status,200);
 assert.equal((await call('my/'+pid,'PATCH',{version,data},'alice')).status,409); // optimistic concurrency
 detail=await call('my/'+pid,'GET',undefined,'alice');version=detail.data.project.version;
 assert.equal((await call('my/'+pid,'PATCH',{version,data:{...data,recipient:'Nový příjemce'}},'alice')).status,200);
 assert.equal((await call('projects/'+pid+'/qr','POST',{})).status,409); // recipient freezes support
 assert.equal((await call('projects/'+slug)).data.project.recipient,data.recipient); // public snapshot preserved
 await call('my/'+pid+'/submit','POST',{},'alice');adminProject=(await call('my/'+pid,'GET',undefined,'alice')).data.project;assert.equal((await call('admin/projects','POST',{id:pid,action:'approve',version:adminProject.version},'admin')).status,200);assert.equal((await call('projects/'+pid+'/qr','POST',{})).status,200);
 assert.equal((await call('reports','POST',{project:pid,reason:'Podezřelý obsah pro test moderace.'})).status,200);
 const reports=await call('admin/reports','GET',undefined,'admin');assert.equal(reports.data.reports.length,1);assert.equal((await call('admin/reports','POST',{id:reports.data.reports[0].id,status:'resolved',note:'Zkontrolováno'},'admin')).status,200);
 assert.equal((await call('my/'+pid+'/updates','POST',{title:'Novinka',body:'Text aktuality'},'alice')).status,200);
 assert.equal((await call('admin/users','POST',{id:'supabase:bob',role:'admin'},'alice')).status,403);
 await call('admin/users','POST',{id:'supabase:alice',role:'author',blocked:true},'admin');assert.equal((await call('my','GET',undefined,'alice')).status,403);assert.equal((await call('projects/'+slug)).status,404);assert.equal((await call('projects/'+pid+'/qr','POST',{})).status,409);
 await call('admin/users','POST',{id:'supabase:alice',role:'author',blocked:false},'admin');
 assert.equal((await call('my/'+pid+'/pause','POST',{},'alice')).status,200);assert.equal((await call('my/'+pid+'/updates','POST',{title:'Neveřejná novinka',body:'Při pozastavení zakázáno'},'alice')).status,400);assert.equal((await call('projects/'+slug)).status,404);assert.equal((await call('media/'+file.data.url.split('/').pop())).status,404);
 await call('my/'+pid+'/restore','POST',{},'alice');assert.equal((await call('my/'+pid,'GET',undefined,'alice')).data.project.status,'draft');assert.equal((await call('projects/'+pid+'/qr','POST',{})).status,409);
 const notifications=await call('my','GET',undefined,'alice');assert.ok(notifications.data.notifications.length>0);assert.ok(notifications.data.notifications.every((n:any)=>n.status==='inactive'));
 assert.equal((await call('admin/audit','GET',undefined,'admin')).status,200);assert.equal((await call('reports')).status,404);assert.equal((await call('auth/signup','POST',{email:'test@example.test',password:'long-enough-password',consent:true})).status,200);
 console.log('Ověřeno',checks,'API požadavků. Testovací údaje existují pouze v paměti testu.');
});
