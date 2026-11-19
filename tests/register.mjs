import {registerHooks} from 'node:module';
const runtime=new URL('./runtime.mjs',import.meta.url).href;
registerHooks({resolve(s,c,next){if(s==='cloudflare:workers'||s==='next/headers')return {url:runtime,shortCircuit:true};return next(s,c)}});
