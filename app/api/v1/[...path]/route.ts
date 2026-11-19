import {cookies} from 'next/headers';
import {all,one,run,user,staff,ownProject,audit,history,now,id,rate,publicContent,categoryList,dataInput,web,image,notify,authFetch,setSession,config,fail,HttpError,db} from '@/lib/server';
import {spayd} from '@/lib/payment';
import {defaults,defaultCategories} from '@/lib/shared';
export const dynamic='force-dynamic';
const json=(d:any,status=200)=>Response.json(d,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function handler(req:Request){try{
 const url=new URL(req.url),path=url.pathname.replace(/^\/api\/v1\//,'').split('/'),[root,key,action]=path,method=req.method;
 const ip=req.headers.get('cf-connecting-ip')||'unknown';
 if(method!=='GET'){
  if(req.headers.get('origin')!==url.origin)fail(403,'Neplatný původ požadavku.');
  await rate('write:'+ip,100);if(Number(req.headers.get('content-length')||0)>6*1024*1024)fail(413,'Soubor je příliš velký.');
 }
 const body=async()=>{const t=new TextDecoder().decode(await readLimited(req,40000));try{return JSON.parse(t)}catch{fail(400,'Neplatná data.')}};
 if(root==='config')return json({auth:!!(config().SUPABASE_URL&&config().SUPABASE_PUBLISHABLE_KEY),email:!!(config().RESEND_API_KEY&&config().EMAIL_FROM),content:await publicContent(),categories:await categoryList()});
 if(root==='auth'){
  if(method!=='POST')fail(405,'Nepodporovaná metoda.');await rate('auth:'+ip,12,300);const b=await body();
  if(key==='logout'){const c=await cookies();const token=c.get('pa_access')?.value;if(token&&config().SUPABASE_URL)await fetch(config().SUPABASE_URL+'/auth/v1/logout',{method:'POST',headers:{apikey:config().SUPABASE_PUBLISHABLE_KEY!,Authorization:'Bearer '+token}});c.delete('pa_access');c.delete('pa_refresh');return json({ok:true});}
  if(key==='session'){if(b.access_token&&b.refresh_token){const c=config();if(!c.SUPABASE_URL||!c.SUPABASE_PUBLISHABLE_KEY)fail(503,'Přihlášení není připojené.');const check=await fetch(c.SUPABASE_URL+'/auth/v1/user',{headers:{apikey:c.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+String(b.access_token)}});if(!check.ok)fail(401,'Ověřovací odkaz již není platný.');const verified=await check.json() as any;if(!verified.email_confirmed_at)fail(403,'E-mail není ověřený.');await setSession(b);return json({ok:true});}if(!b.token_hash||!['email','signup','recovery'].includes(b.type))fail(400,'Neplatný ověřovací odkaz.');const d=await authFetch('/verify',{token_hash:b.token_hash,type:b.type});await setSession(d);return json({ok:true});}
  if(key==='password'){const c=await cookies(),token=c.get('pa_access')?.value;if(!token)fail(401,'Otevřete platný odkaz pro obnovu hesla.');if(typeof b.password!=='string'||b.password.length<12)fail(400,'Heslo musí mít alespoň 12 znaků.');await authFetch('/user',{password:b.password},token);return json({ok:true});}
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email||''))fail(400,'Zadejte platný e-mail.');
  if(key==='recover'){await authFetch('/recover',{email:b.email,redirect_to:url.origin+'/obnova-hesla'});return json({message:'Pokud účet existuje, přijde vám e-mail s odkazem pro obnovu.'});}
  if(typeof b.password!=='string'||b.password.length<12)fail(400,'Heslo musí mít alespoň 12 znaků.');
  if(key==='signup'){if(!b.consent)fail(400,'Pro registraci je nutný souhlas s podmínkami.');const d=await authFetch('/signup?redirect_to='+encodeURIComponent(url.origin+'/potvrzeni'),{email:b.email,password:b.password,data:{name:String(b.name||'Nový autor').slice(0,100)}});return json({message:'Registraci potvrďte odkazem v e-mailu.'});}
  if(key==='login'){const d=await authFetch('/token?grant_type=password',{email:b.email,password:b.password});if(!d.user?.email_confirmed_at)fail(403,'Nejprve ověřte e-mail.');await setSession(d);return json({ok:true});}
  fail(404,'Nenalezeno.');
 }
 if(root==='me'){
  const u=await user(method!=='GET');if(method==='GET')return json({user:u});if(!u)fail(401,'Přihlaste se.');
  if(method==='PATCH'){const b=await body();const name=String(b.name||'').trim().slice(0,100);if(!name)fail(400,'Vyplňte jméno.');const ico=String(b.ico||'').trim();if(ico&&!/^\d{8}$/.test(ico))fail(400,'IČO musí mít 8 číslic.');const avatar=image(b.avatar);if(avatar){const file=await one('SELECT owner FROM uploads WHERE id=?',avatar.split('/').pop());if(file?.owner!==u.id)fail(403,'Cizí fotografie.');}await run('UPDATE users SET name=?,bio=?,website=?,ico=?,avatar=? WHERE id=?',name,String(b.bio||'').slice(0,2000),web(b.website),ico,avatar,u.id);return json({ok:true});}
 }
 if(root==='authors'&&method==='GET'){const a=await one('SELECT id,name,bio,website,ico,avatar FROM users WHERE id=? AND blocked=0',decodeURIComponent(key));if(!a)fail(404,'Autor neexistuje.');const projects=await all("SELECT id,slug,published,featured,status,payment_enabled FROM projects WHERE owner=? AND published IS NOT NULL AND status IN ('published','pending','changes','rejected')",a.id);return json({author:a,projects:projects.map(publicProject)});}
 if(root==='projects'&&method==='GET'){
  if(!key){const q=(url.searchParams.get('q')||'').slice(0,100),cat=url.searchParams.get('category')||'',page=Math.max(1,Math.min(1000,Number(url.searchParams.get('page'))||1)),sort=url.searchParams.get('sort')==='featured'?'featured DESC,created DESC':'created DESC';
   const conditions="published IS NOT NULL AND status IN ('published','pending','changes','rejected') AND owner IN (SELECT id FROM users WHERE blocked=0) AND (?='' OR json_extract(published,'$.category')=?) AND (?='' OR json_extract(published,'$.title') LIKE ? OR json_extract(published,'$.summary') LIKE ?)";const args=[cat,cat,q,'%'+q+'%','%'+q+'%'];
   const rows=await all(`SELECT id,slug,published,featured,status,payment_enabled FROM projects WHERE ${conditions} ORDER BY ${sort} LIMIT 9 OFFSET ?`,...args,(page-1)*9);const count=await one(`SELECT count(*) AS n FROM projects WHERE ${conditions}`,...args);return json({projects:rows.map(publicProject),total:count.n,page});
  }
  const p=await one("SELECT p.*,u.name,u.avatar,u.bio FROM projects p JOIN users u ON u.id=p.owner WHERE p.slug=? AND p.published IS NOT NULL AND p.status IN ('published','pending','changes','rejected') AND u.blocked=0",key);if(!p)fail(404,'Projekt není zveřejněný.');const updates=await all('SELECT * FROM updates WHERE project=? ORDER BY created DESC',p.id);return json({project:{...publicProject(p),owner:p.owner,author:{name:p.name,avatar:p.avatar,bio:p.bio},updates}});
 }
 if(root==='projects'&&key&&action==='qr'&&method==='POST'){
  await rate('qr:'+ip,30);const p=await one("SELECT p.* FROM projects p JOIN users u ON u.id=p.owner WHERE p.id=? AND p.published IS NOT NULL AND p.status IN ('published','pending','changes','rejected') AND p.payment_enabled=1 AND u.blocked=0",key);if(!p)fail(409,'Podpora tohoto projektu nyní není aktivní.');const b=await body();const data=JSON.parse(p.published);const payload=spayd(data,b.amount);await run('INSERT INTO events VALUES(?,?,?,?)',id(),p.id,'qr',now());return json({payload,recipient:data.recipient,account:data.account,message:'Podpora '+data.title});
 }
 if(root==='projects'&&key&&action==='view'&&method==='POST'){await rate('view:'+ip+':'+key,1,1800);const p=await one("SELECT id FROM projects WHERE id=? AND published IS NOT NULL AND status NOT IN ('draft','paused','archived')",key);if(!p)fail(404,'Projekt nenalezen.');await run('INSERT INTO events VALUES(?,?,?,?)',id(),key,'view',now());return json({ok:true});}
 if(root==='my'){
  const u=(await user())!;
  if(!key&&method==='GET'){const rows=await all('SELECT * FROM projects WHERE owner=? ORDER BY updated DESC',u.id);return json({projects:await Promise.all(rows.map(async p=>({...p,draft:JSON.parse(p.draft),published:p.published?JSON.parse(p.published):null,stats:await all('SELECT kind,count(*) AS n FROM events WHERE project=? GROUP BY kind',p.id)}))),notifications:await all('SELECT subject,body,status,created FROM notifications WHERE recipient=? ORDER BY created DESC LIMIT 20',u.id)});}
  if(!key&&method==='POST'){const b=await body(),d=await dataInput(b,u.id);const pid=id(),slug=slugify(d.title||'projekt')+'-'+pid.slice(0,8);await run('INSERT INTO projects(id,owner,slug,draft,created,updated) VALUES(?,?,?,?,?,?)',pid,u.id,slug,JSON.stringify(d),now(),now());await audit(u.id,'create',pid);return json({id:pid},201);}
  const p=await ownProject(key,u);if(p.owner!==u.id)fail(403,'Použijte správu projektů.');
  if(method==='GET')return json({project:{...p,draft:JSON.parse(p.draft),published:p.published?JSON.parse(p.published):null},history:await all('SELECT action,created FROM revisions WHERE project=? ORDER BY created DESC',key),updates:await all('SELECT * FROM updates WHERE project=? ORDER BY created DESC',key)});
  if(method==='PATCH'){
   const b=await body();if(Number(b.version)!==p.version)fail(409,'Projekt se mezitím změnil. Načtěte aktuální verzi.');if(['paused','archived'].includes(p.status))fail(409,'Nejprve projekt obnovte.');const d=await dataInput(b.data,u.id);const published=p.published?JSON.parse(p.published):null;const changed=published&&(published.account!==d.account||published.recipient!==d.recipient||published.vs!==d.vs);
   const newStatus=p.published?'changes':'draft';await history(p,u.id,'Uložení konceptu');const result=await run('UPDATE projects SET draft=?,status=?,payment_enabled=?,version=version+1,updated=? WHERE id=? AND version=?',JSON.stringify(d),newStatus,changed?0:p.payment_enabled,now(),key,p.version);if(!result.meta.changes)fail(409,'Souběžná změna. Načtěte projekt znovu.');return json({ok:true,version:p.version+1});
  }
  if(method==='POST'&&action==='submit'){const d=await dataInput(JSON.parse(p.draft),u.id,true);if(['paused','archived'].includes(p.status))fail(409,'Obnovte projekt.');await history(p,u.id,'Odeslání ke schválení');const result=await run("UPDATE projects SET draft=?,status='pending',version=version+1,updated=? WHERE id=? AND version=? AND status NOT IN ('paused','archived')",JSON.stringify(d),now(),key,p.version);if(!result.meta.changes)fail(409,'Projekt byl mezitím změněn. Načtěte jej znovu.');await audit(u.id,'submit',key);await notify(u.id,'Projekt čeká na schválení','Váš projekt '+d.title+' byl odeslán ke kontrole.');return json({ok:true});}
  if(method==='POST'&&['pause','archive','restore'].includes(action)){const status=action==='pause'?'paused':action==='archive'?'archived':'draft';await history(p,u.id,action);await run('UPDATE projects SET status=?,payment_enabled=0,version=version+1,updated=? WHERE id=?',status,now(),key);await audit(u.id,action,key);return json({ok:true});}
  if(method==='POST'&&action==='updates'){if(!p.published||['paused','archived'].includes(p.status))fail(400,'Aktuality lze přidávat jen k aktivnímu zveřejněnému projektu.');const b=await body();if(!b.title?.trim()||!b.body?.trim())fail(400,'Vyplňte název a text aktuality.');await run('INSERT INTO updates VALUES(?,?,?,?,?)',id(),key,String(b.title).slice(0,150),String(b.body).slice(0,5000),now());await audit(u.id,'update-post',key);return json({ok:true});}
 }
 if(root==='reports'&&method==='POST'){await rate('report:'+ip,4,3600);const b=await body();if(b.honeypot)fail(400,'Neplatný formulář.');if(String(b.reason||'').trim().length<15)fail(400,'Popište prosím důvod alespoň 15 znaky.');if(b.project&&!await one('SELECT id FROM projects WHERE id=?',b.project))fail(404,'Projekt neexistuje.');await run('INSERT INTO reports(id,project,email,reason,created) VALUES(?,?,?,?,?)',id(),b.project||null,String(b.email||'').slice(0,250),String(b.reason).slice(0,4000),now());return json({ok:true});}
 if(root==='uploads'&&method==='POST'){
  const u=(await user())!;await rate('uploads:'+u.id,20,3600);const bytes=await readLimited(req,5*1024*1024);if(bytes.length>5*1024*1024||bytes.length<12)fail(400,'Obrázek musí mít nejvýše 5 MB.');
  const mime=bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;if(!mime)fail(400,'Nahrajte JPEG, PNG nebo WebP. SVG a jiné soubory nejsou povolené.');
  const file=id();await config().BUCKET.put(file,bytes,{httpMetadata:{contentType:mime}});await run('INSERT INTO uploads VALUES(?,?,?,?,?)',file,u.id,mime,bytes.length,now());return json({url:'/api/v1/media/'+file},201);
 }
 if(root==='media'&&method==='GET'){
  const f=await one('SELECT * FROM uploads WHERE id=?',key);if(!f)fail(404,'Obrázek nenalezen.');const mediaUrl='/api/v1/media/'+key;
  const published=await one("SELECT p.id FROM projects p JOIN users u ON u.id=p.owner WHERE p.published IS NOT NULL AND p.status IN ('published','pending','changes','rejected') AND u.blocked=0 AND (json_extract(p.published,'$.image')=? OR EXISTS(SELECT 1 FROM json_each(json_extract(p.published,'$.gallery')) WHERE value=?)) LIMIT 1",mediaUrl,mediaUrl);
  const avatar=await one('SELECT id FROM users WHERE avatar=? AND blocked=0',mediaUrl);
  if(!published&&!avatar){const u=await user(false);if(!u||(u.id!==f.owner&&!['admin','moderator'].includes(u.role)))fail(404,'Obrázek není veřejný.');}
  const obj=await config().BUCKET.get(key);if(!obj)fail(404,'Obrázek nenalezen.');return new Response(obj.body,{headers:{'Content-Type':f.mime,'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=60','Content-Security-Policy':"default-src 'none'"}});
 }
 if(root==='admin'){
  const u=await staff();
  if(method==='GET'){
   if(!key||key==='overview'){const projects=await one('SELECT count(*) AS n FROM projects'),users=await one('SELECT count(*) AS n FROM users'),reports=await one("SELECT count(*) AS n FROM reports WHERE status='open'"),pending=await one("SELECT count(*) AS n FROM projects WHERE status='pending'");return json({projects:projects.n,users:users.n,reports:reports.n,pending:pending.n,email:!!(config().RESEND_API_KEY&&config().EMAIL_FROM),auth:!!config().SUPABASE_URL});}
   if(key==='projects'){const p=await all('SELECT p.*,u.name AS author_name FROM projects p JOIN users u ON u.id=p.owner ORDER BY updated DESC');return json({projects:p.map(x=>({...x,draft:JSON.parse(x.draft),published:x.published?JSON.parse(x.published):null}))});}
   if(key==='history'){return json({history:await all('SELECT * FROM revisions WHERE project=? ORDER BY created DESC',url.searchParams.get('project')||'')});}
   if(key==='users')return json({users:await all('SELECT * FROM users ORDER BY created DESC')});
   if(key==='reports')return json({reports:await all('SELECT r.*,p.slug FROM reports r LEFT JOIN projects p ON p.id=r.project ORDER BY r.created DESC')});
   if(key==='categories')return json({categories:await categoryList(true)});
   if(key==='content')return json({content:await publicContent()});
   if(key==='audit')return json({audit:await all('SELECT * FROM audit ORDER BY created DESC LIMIT 300')});
  }
  if(method==='POST'){
   const b=await body();
   if(key==='projects'){
    const p=await ownProject(b.id,u);if(Number(b.version)!==p.version)fail(409,'Projekt se od otevření kontroly změnil. Načtěte jej znovu.');const a=b.action;const note=String(b.note||'').trim().slice(0,2000);if(['reject','changes','pause'].includes(a)&&!note)fail(400,'Uveďte důvod rozhodnutí.');await history(p,u.id,'Moderace: '+a);
    if(a==='approve'){
     if(p.status!=='pending')fail(409,'Schválit lze pouze projekt čekající na schválení.');const d=await dataInput(JSON.parse(p.draft),p.owner,true);const approved=await run("UPDATE projects SET published=?,status='published',payment_enabled=1,note=?,version=version+1,updated=? WHERE id=? AND version=? AND status='pending'",JSON.stringify(d),note,now(),p.id,p.version);if(!approved.meta.changes)fail(409,'Projekt se během schvalování změnil. Zkontrolujte novou verzi.');
    }else if(a==='feature'){if(!p.published)fail(400,'Zvýraznit lze pouze schválený projekt.');const featured=await run('UPDATE projects SET featured=?,version=version+1,updated=? WHERE id=? AND version=?',p.featured?0:1,now(),p.id,p.version);if(!featured.meta.changes)fail(409,'Projekt byl mezitím změněn.');}
    else {const status=({reject:'rejected',changes:'changes',pause:'paused',archive:'archived',restore:'draft'} as Record<string,string>)[a];if(!status)fail(400,'Neplatná akce.');const result=await run('UPDATE projects SET status=?,note=?,payment_enabled=CASE WHEN ? IN (\'paused\',\'archived\',\'draft\') THEN 0 ELSE payment_enabled END,version=version+1,updated=? WHERE id=? AND version=?',status,note,status,now(),p.id,p.version);if(!result.meta.changes)fail(409,'Projekt byl mezitím změněn.');}
    await audit(u.id,a,p.id,note);await notify(p.owner,'Změna stavu projektu',`Projekt ${JSON.parse(p.draft).title}: ${a==='approve'?'schválen':a}. ${note}`);return json({ok:true});
   }
   if(key==='users'){await staff(true);if(b.id===u.id)fail(400,'Vlastní oprávnění ani blokaci zde nelze měnit.');if(!['author','moderator','admin'].includes(b.role))fail(400,'Neplatná role.');await run('UPDATE users SET role=?,blocked=? WHERE id=?',b.role,b.blocked?1:0,b.id);await audit(u.id,'user-change',b.id,JSON.stringify({role:b.role,blocked:!!b.blocked}));return json({ok:true});}
   if(key==='reports'){if(!['open','reviewing','resolved','dismissed'].includes(b.status))fail(400,'Neplatný stav.');await run('UPDATE reports SET status=?,note=? WHERE id=?',b.status,String(b.note||'').slice(0,2000),b.id);await audit(u.id,'report-change',b.id,b.status);return json({ok:true});}
   if(key==='categories'){await staff(true);for(const [position,c] of defaultCategories.entries())await run('INSERT OR IGNORE INTO categories VALUES(?,?,?,1)',c.id,c.name,position);if(!/^[a-z0-9-]{1,50}$/.test(b.id)||!String(b.name||'').trim())fail(400,'Vyplňte identifikátor a název.');await run('INSERT INTO categories VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,position=excluded.position,active=excluded.active',b.id,String(b.name).slice(0,70),Number(b.position)||0,b.active?1:0);await audit(u.id,'category',b.id);return json({ok:true});}
   if(key==='content'){await staff(true);if(!Object.hasOwn(defaults,b.key))fail(400,'Neplatná položka.');await run('INSERT INTO content VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',b.key,String(b.value||'').slice(0,15000));await audit(u.id,'content',b.key);return json({ok:true});}
  }
 }
 fail(404,'Požadovaná stránka neexistuje.');
 }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);if(e instanceof Error&&/Částka|částku|symbol|IBAN|účtu|příjemce/.test(e.message))return json({error:e.message},400);console.error('API failure',e instanceof Error?e.message:'unknown');return json({error:'Požadavek se nepodařilo dokončit. Zkuste to znovu.'},500);}}
async function readLimited(req:Request,limit:number){const reader=req.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let size=0;for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();fail(413,'Požadavek je příliš velký.');}chunks.push(value)}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return bytes;}
function slugify(s:string){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,65)||'projekt';}
function publicProject(p:any){const d=JSON.parse(p.published);return {...d,id:p.id,slug:p.slug,featured:p.featured,paymentEnabled:!!p.payment_enabled};}
export {handler as GET,handler as POST,handler as PATCH};
