import {env} from 'cloudflare:workers';
import {cookies,headers} from 'next/headers';
import type {ProjectData,User} from './shared';
import {defaultCategories,defaults} from './shared';
import {account} from './payment';
type AppConfig={DB:D1Database;BUCKET:R2Bucket;SUPABASE_URL?:string;SUPABASE_PUBLISHABLE_KEY?:string;RESEND_API_KEY?:string;EMAIL_FROM?:string;ADMIN_USER_ID?:string;SITE_ORIGIN?:string};
// This is a public, low-privilege Supabase publishable key, NOT a service role secret.
// The server still verifies each user's access token with Supabase Auth.
const DEFAULT_SUPABASE_URL='https://yqhfhpjthxcbbzdlisgt.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY="sb_publishable_J4ZxKqxJDRy8q6RtIacMWA_ORFXDcoY";
export function config():AppConfig{const current=env as unknown as AppConfig;return {...current,SUPABASE_URL:current.SUPABASE_URL||DEFAULT_SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:current.SUPABASE_PUBLISHABLE_KEY||DEFAULT_SUPABASE_PUBLISHABLE_KEY};}
export const now=()=>new Date().toISOString();export const id=()=>crypto.randomUUID();
export const db=()=>config().DB;
export async function one<T=any>(sql:string,...v:any[]):Promise<T|null>{return db().prepare(sql).bind(...v).first<T>();}
export async function all<T=any>(sql:string,...v:any[]):Promise<T[]>{return (await db().prepare(sql).bind(...v).all<T>()).results;}
export async function run(sql:string,...v:any[]){return db().prepare(sql).bind(...v).run();}
export class HttpError extends Error {constructor(public status:number,message:string){super(message)}}
export function fail(status:number,message:string):never{throw new HttpError(status,message);}
export async function identity():Promise<{id:string;email:string;name:string}|null>{
 const h=await headers();
 // On public deployments with email auth, do not accept hosting-specific identity headers.
 const site=config().SUPABASE_URL&&config().SUPABASE_PUBLISHABLE_KEY?null:h.get('oai-authenticated-user-id');
 if(site)return {id:'sites:'+site,email:h.get('oai-authenticated-user-email')||'',name:decode(h.get('oai-authenticated-user-full-name')||'Nový autor')};
 const c=await cookies(),token=c.get('pa_access')?.value;
 if(!token||!config().SUPABASE_URL||!config().SUPABASE_PUBLISHABLE_KEY)return null;
 const authHeaders=(access:string)=>({apikey:config().SUPABASE_PUBLISHABLE_KEY!,Authorization:'Bearer '+access});
 let r=await fetch(config().SUPABASE_URL+'/auth/v1/user',{headers:authHeaders(token)});
 if(r.status===401||r.status===403){
  const refresh=c.get('pa_refresh')?.value;
  if(!refresh){c.delete('pa_access');return null;}
  let fresh:any;
  try{fresh=await authFetch('/token?grant_type=refresh_token',{refresh_token:refresh});}
  catch(e){
   // A rejected refresh token means a genuinely expired/revoked session.
   // Preserve credentials on a provider outage so the user can retry.
   if(e instanceof HttpError&&e.status===400){c.delete('pa_access');c.delete('pa_refresh');return null;}
   throw e;
  }
  if(!fresh?.access_token){c.delete('pa_access');c.delete('pa_refresh');return null;}
  await setSession(fresh);
  r=await fetch(config().SUPABASE_URL+'/auth/v1/user',{headers:authHeaders(fresh.access_token)});
 }
 if(r.status===401||r.status===403){c.delete('pa_access');c.delete('pa_refresh');return null;}
 if(!r.ok)fail(503,'Ověření přihlášení je dočasně nedostupné.');
 const u=await r.json() as any;
 if(!u.email_confirmed_at)return null;
 return {id:'supabase:'+u.id,email:u.email||'',name:u.user_metadata?.name||'Nový autor'};
}
function decode(s:string){try{return decodeURIComponent(s)}catch{return s}}
export async function user(required=true):Promise<User|null>{
 const i=await identity();if(!i){if(required)fail(401,'Nejprve se přihlaste.');return null;}
 await run('INSERT OR IGNORE INTO users(id,email,name,created) VALUES(?,?,?,?)',i.id,i.email,i.name,now());
 if(config().ADMIN_USER_ID&&config().ADMIN_USER_ID===i.id)await run("UPDATE users SET role='admin' WHERE id=?",i.id);
 const u=await one<User>('SELECT * FROM users WHERE id=?',i.id);if(u?.blocked)fail(403,'Účet je zablokovaný. Kontaktujte provozovatele.');return u;
}
export async function staff(adminOnly=false){const u=(await user())!;if(!(adminOnly?u.role==='admin':['admin','moderator'].includes(u.role)))fail(403,'Pro tuto akci nemáte oprávnění.');return u;}
export async function ownProject(pid:string,u:User){const p=await one('SELECT * FROM projects WHERE id=?',pid);if(!p)fail(404,'Projekt neexistuje.');if(p.owner!==u.id&&!['admin','moderator'].includes(u.role))fail(403,'Tento projekt nemůžete upravovat.');return p;}
export async function audit(actor:string,action:string,target:string,detail=''){await run('INSERT INTO audit VALUES(?,?,?,?,?,?)',id(),actor,action,target,detail,now());}
export async function history(p:any,actor:string,action:string){await run('INSERT INTO revisions VALUES(?,?,?,?,?,?)',id(),p.id,actor,p.draft,action,now());}
export async function rate(key:string,max:number,seconds=60){const stamp=Math.floor(Date.now()/1000);await run('INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<? THEN excluded.expires ELSE expires END',key,stamp+seconds,stamp,stamp);const r=await one('SELECT count FROM rate_limits WHERE key=?',key);if(r.count>max)fail(429,'Příliš mnoho požadavků. Zkuste to za chvíli.');}
export async function publicContent(){const rows=await all('SELECT * FROM content');return {...defaults,...Object.fromEntries(rows.map(r=>[r.key,r.value]))};}
export async function categoryList(includeInactive=false){const list=await all('SELECT * FROM categories '+(includeInactive?'':'WHERE active=1')+' ORDER BY position,name');return list.length||await one('SELECT id FROM categories LIMIT 1')?list:defaultCategories.map((x,i)=>({...x,position:i,active:1}));}
function str(v:any,max:number){return typeof v==='string'?v.trim().slice(0,max):'';}
export function web(v:any){const s=str(v,300);if(!s)return '';try{const u=new URL(s);if(!['https:','http:'].includes(u.protocol))throw Error();return u.toString();}catch{fail(400,'Odkaz musí začínat https:// nebo http://.')}}
export function image(v:any){const s=str(v,200);if(!s)return '';if(!/^\/api\/v1\/media\/[a-z0-9-]+$/i.test(s))fail(400,'Použijte obrázek nahraný do platformy.');return s;}
export async function dataInput(raw:any,uid:string,submit=false):Promise<ProjectData>{
 const d:ProjectData={title:str(raw.title,100),category:str(raw.category,50),summary:str(raw.summary,220),description:str(raw.description,12000),purpose:str(raw.purpose,4000),website:web(raw.website),image:image(raw.image),gallery:Array.isArray(raw.gallery)?raw.gallery.slice(0,8).map(image):[],recipient:str(raw.recipient,150),account:str(raw.account,50),vs:str(raw.vs,10)};
 const cats=await categoryList();if(!cats.some(c=>c.id===d.category))fail(400,'Vyberte aktivní kategorii.');
 if(d.account){try{d.account=account(d.account).iban}catch(e){fail(400,(e as Error).message)}}
 if(d.vs&&!/^\d{1,10}$/.test(d.vs))fail(400,'Variabilní symbol musí mít 1 až 10 číslic.');
 for(const url of [d.image,...d.gallery].filter(Boolean)){const file=await one('SELECT owner FROM uploads WHERE id=?',url.split('/').pop());if(!file||file.owner!==uid)fail(403,'Obrázek není ve vašem účtu.');}
 if(submit&&(!d.title||d.summary.length<15||d.description.length<40||d.purpose.length<15||!d.image||!d.recipient||!d.account))fail(400,'Doplňte název, představení (15 znaků), popis (40), využití podpory (15), fotografii, příjemce a platný účet.');
 return d;
}
export async function notify(uid:string,subject:string,body:string){const u=await one('SELECT email FROM users WHERE id=?',uid);if(!u)return;const c=config();let status='inactive';if(c.RESEND_API_KEY&&c.EMAIL_FROM){try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+c.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:c.EMAIL_FROM,to:[u.email],subject,text:body})});status=r.ok?'sent':'failed';}catch{status='failed';}}
 await run('INSERT INTO notifications VALUES(?,?,?,?,?,?)',id(),uid,subject,body,status,now());
}
export async function authFetch(path:string,body:any,token?:string){const c=config();if(!c.SUPABASE_URL||!c.SUPABASE_PUBLISHABLE_KEY)fail(503,'E-mailové přihlášení momentálně není dostupné.');const r=await fetch(c.SUPABASE_URL+'/auth/v1'+path,{method:path==='/user'?'PUT':'POST',headers:{apikey:c.SUPABASE_PUBLISHABLE_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});const d=await r.json() as any;if(!r.ok)fail(r.status>=500?502:400,d.msg||d.error_description||d.message||'Požadavek se nepodařilo dokončit.');return d;}
export async function setSession(d:any){const c=await cookies();for(const [name,value] of [['pa_access',d.access_token],['pa_refresh',d.refresh_token]])if(value)c.set(name,value,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:name==='pa_access'?3600:60*60*24*30});}
