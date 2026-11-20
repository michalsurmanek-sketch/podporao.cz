'use client';
import {useEffect,useState} from 'react';
import Platform from './platform';

const LAUNCH = new Date('2026-12-01T00:00:00+01:00').getTime();
const KEY = 'podporao-preview-access';

export default function Page(){
  const [now,setNow]=useState<number|null>(null);
  const [preview,setPreview]=useState(false);
  const [showCode,setShowCode]=useState(false);
  const [code,setCode]=useState('');
  const [error,setError]=useState(false);
  useEffect(()=>{
    setPreview(sessionStorage.getItem(KEY)==='yes');
    setNow(Date.now());
    const timer=setInterval(()=>setNow(Date.now()),1000);
    return ()=>clearInterval(timer);
  },[]);
  const remaining=Math.max(0,LAUNCH-(now??LAUNCH));
  if(preview)return <Platform/>;
  const seconds=Math.floor(remaining/1000);
  const values=[Math.floor(seconds/86400),Math.floor(seconds%86400/3600),Math.floor(seconds%3600/60),seconds%60];
  function enter(e:React.FormEvent){
    e.preventDefault();
    if(code==='1234'){sessionStorage.setItem(KEY,'yes');setPreview(true);}
    else{setError(true);setCode('');}
  }
  return <main style={{minHeight:'100dvh',display:'flex',alignItems:'center',justifyContent:'center',padding:'32px 20px',background:'radial-gradient(ellipse at 50% 25%,#fff5e9 0%,#fff 55%,#f8fafc 100%)',color:'#172033',fontFamily:'Arial, sans-serif',textAlign:'center',position:'relative'}}>
    <div style={{maxWidth:760,width:'100%'}}>
      <div style={{display:'inline-flex',alignItems:'center',gap:12,fontSize:29,fontWeight:800,letterSpacing:'-1.3px',marginBottom:48}}><span style={{display:'inline-grid',placeItems:'center',width:45,height:45,borderRadius:14,background:'#f97316',color:'#fff',fontSize:30}}>♥</span>Podporao<span style={{color:'#f97316'}}>.cz</span></div>
      <div style={{display:'inline-block',padding:'9px 18px',borderRadius:999,background:'#fff0e4',color:'#c65b0a',fontWeight:700,fontSize:13,letterSpacing:1.5,textTransform:'uppercase',marginBottom:24}}>Na webu právě pracujeme</div>
      <h1 style={{fontSize:'clamp(48px,10vw,92px)',lineHeight:1.04,letterSpacing:'-0.06em',margin:'0 0 24px',fontWeight:850}}>Tvoříme místo, kde pomoc dává smysl<span style={{color:'#f97316'}}>.</span></h1>
      <p style={{fontSize:'clamp(17px,3vw,21px)',lineHeight:1.65,color:'#64748b',maxWidth:550,margin:'0 auto 45px'}}>Podporao.cz je právě ve výstavbě. Připravujeme prostor, kde se dobré nápady potkají s lidmi, kteří je chtějí podpořit. Plánované spuštění: 1. prosince 2026.</p>
      <a href="/nahled" aria-label="Otevřít náhled webu Podporao" title="Kliknutím otevřete web" style={{color:'inherit',textDecoration:'none',cursor:'pointer',display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:'clamp(8px,2vw,18px)',maxWidth:560,margin:'0 auto 38px'}}>
        {values.map((v,i)=><div key={i} style={{background:'#fff',border:'1px solid #f1e8df',boxShadow:'0 12px 35px #a96c3112',borderRadius:18,padding:'clamp(14px,3vw,25px) 5px'}}><div style={{fontSize:'clamp(27px,6vw,49px)',fontWeight:800,fontVariantNumeric:'tabular-nums',letterSpacing:'-0.04em'}}>{String(v).padStart(2,'0')}</div><div style={{fontSize:'clamp(10px,2vw,13px)',color:'#64748b',marginTop:8}}>{['Dní','Hodin','Minut','Sekund'][i]}</div></div>)}
      </a>
      <p style={{fontSize:14,color:'#94a3b8'}}>Děkujeme za trpělivost. Brzy se tu potkáme.</p>
    </div>
    <div style={{position:'fixed',right:18,bottom:18,textAlign:'right'}}>
      {showCode&&<form onSubmit={enter} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:14,padding:16,boxShadow:'0 12px 35px #0002',marginBottom:10,width:230}}>
        <label htmlFor="preview-code" style={{display:'block',fontSize:13,fontWeight:700,marginBottom:9}}>Vstup pro správce</label>
        <input id="preview-code" type="password" inputMode="numeric" autoFocus value={code} onChange={e=>{setCode(e.target.value);setError(false)}} placeholder="Přístupový kód" style={{width:'100%',boxSizing:'border-box',padding:10,border:'1px solid #cbd5e1',borderRadius:8,fontSize:16}}/>
        {error&&<p role="alert" style={{color:'#dc2626',fontSize:12}}>Nesprávný kód</p>}
        <button type="submit" style={{width:'100%',background:'#f97316',color:'white',border:0,borderRadius:8,padding:10,marginTop:10,cursor:'pointer',fontWeight:700}}>Otevřít web</button>
      </form>}
      <button type="button" aria-label="Vstup pro správce" onClick={()=>setShowCode(!showCode)} style={{background:'transparent',border:0,color:'#a5acb7',cursor:'pointer',fontSize:18,padding:9}}>⚙</button>
    </div>
  </main>;
}
