import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0000_abandoned_randall_flagg.sql',import.meta.url),'utf8'));
let reqHeaders=new Headers();const jar=new Map();const files=new Map();let actingAs=null;
const realFetch=globalThis.fetch;
globalThis.fetch=async (input,options={})=>{
  const url=String(input);
  if(url.startsWith('https://yqhfhpjthxcbbzdlisgt.supabase.co/auth/v1/')){
    const path=new URL(url).pathname;
    if(path==='/auth/v1/user'){
      const token=String(options.headers?.Authorization||'').replace(/^Bearer /,'');
      if(!token.startsWith('test-token-'))return Response.json({message:'Invalid token'},{status:401});
      const name=token.slice('test-token-'.length);
      return Response.json({id:name,email:name+'@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',user_metadata:{name}});
    }
    if(path==='/auth/v1/signup')return Response.json({user:{id:'new-account',email:'test@example.test',identities:[]}});
    return Response.json({message:'Unsupported test endpoint'},{status:400});
  }
  return realFetch(input,options);
};
export function headers(){return Promise.resolve(reqHeaders)}export function cookies(){return Promise.resolve({get:n=>n==='pa_access'&&actingAs?{value:'test-token-'+actingAs}:jar.has(n)?{value:jar.get(n)}:undefined,set:(n,v)=>jar.set(n,v),delete:n=>jar.delete(n)})}
export function requestContext(h){reqHeaders=new Headers(h);actingAs=reqHeaders.get('oai-authenticated-user-id')}
export function setTestCookie(name,value){if(value===null)jar.delete(name);else jar.set(name,value)}
export function getTestCookie(name){return jar.get(name)}
export const database=sql;
export const env={DB:{prepare(q){let args=[];const p={bind(...v){args=v;return p},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){const r=sql.prepare(q).run(...args);return {success:true,meta:{changes:Number(r.changes)}}}};return p},async batch(stmts){return Promise.all(stmts.map(s=>s.run()))}},BUCKET:{async put(k,b,o){files.set(k,{body:b,...o})},async get(k){return files.get(k)||null}}};
