import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../drizzle/0000_abandoned_randall_flagg.sql',import.meta.url),'utf8'));
let reqHeaders=new Headers();const jar=new Map();const files=new Map();
export function headers(){return Promise.resolve(reqHeaders)}export function cookies(){return Promise.resolve({get:n=>jar.has(n)?{value:jar.get(n)}:undefined,set:(n,v)=>jar.set(n,v),delete:n=>jar.delete(n)})}
export function requestContext(h){reqHeaders=new Headers(h)}
export const database=sql;
export const env={DB:{prepare(q){let args=[];const p={bind(...v){args=v;return p},async first(){return sql.prepare(q).get(...args)||null},async all(){return {results:sql.prepare(q).all(...args)}},async run(){const r=sql.prepare(q).run(...args);return {success:true,meta:{changes:Number(r.changes)}}}};return p},async batch(stmts){return Promise.all(stmts.map(s=>s.run()))}},BUCKET:{async put(k,b,o){files.set(k,{body:b,...o})},async get(k){return files.get(k)||null}}};
