/** QR Platba/SPAYD 1.0, https://qr-platba.cz/pro-vyvojare/specifikace-formatu/ */
export function amount(value:unknown):string|undefined {
 if(value===undefined || value===null || value==='') return undefined;
 const s=String(value).trim().replace(',','.');
 if(!/^\d{1,7}(\.\d{1,2})?$/.test(s)) throw Error('Zadejte částku s nejvýše dvěma desetinnými místy.');
 const [a,b='']=s.split('.'); const cents=Number(a)*100+Number(b.padEnd(2,'0'));
 if(cents<=0 || cents>999999999) throw Error('Částka musí být od 0,01 do 9 999 999,99 Kč.');
 return `${Math.floor(cents/100)}.${String(cents%100).padStart(2,'0')}`;
}
function mod97(s:string){let n=0;for(const c of s)n=(n*10+Number(c))%97;return n;}
function checksum(s:string){const weights=[6,3,7,9,10,5,8,4,2,1];return [...s.padStart(10,'0')].reduce((n,c,i)=>n+Number(c)*weights[i],0)%11===0;}
export function account(input:string):{iban:string;domestic:string}{
 let s=input.replace(/\s/g,'').toUpperCase(); let bank,prefix,main;
 if(/^CZ\d{22}$/.test(s)){
  if(mod97(s.slice(4)+'1235'+s.slice(2,4))!==1)throw Error('IBAN nemá platný kontrolní součet.');
  bank=s.slice(4,8);prefix=s.slice(8,14);main=s.slice(14);
 }else{
  const m=/^(?:(\d{1,6})-)?(\d{1,10})\/(\d{4})$/.exec(s);
  if(!m)throw Error('Zadejte český účet (předčíslí-)číslo/kód banky nebo český IBAN.');
  prefix=(m[1]||'0').padStart(6,'0');main=m[2].padStart(10,'0');bank=m[3];
  const bban=bank+prefix+main; s='CZ'+String(98-mod97(bban+'123500')).padStart(2,'0')+bban;
 }
 if(!checksum(prefix)||!checksum(main)||Number(main)===0||Number(bank)===0)throw Error('Číslo účtu nemá platný český kontrolní součet.');
 return {iban:s,domestic:(Number(prefix)?Number(prefix)+'-':'')+Number(main)+'/'+bank};
}
const safe=(s:string,max:number)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 $%+\-./:]/g,' ').trim().slice(0,max).replace(/%/g,'%25');
export function spayd(data:{account:string;recipient:string;title:string;vs?:string},value?:unknown){
 const iban=account(data.account).iban;const am=amount(value);
 if(!data.recipient.trim())throw Error('Chybí příjemce.');
 if(data.vs&&!/^\d{1,10}$/.test(data.vs))throw Error('Variabilní symbol musí mít 1 až 10 číslic.');
 return ['SPD','1.0',`ACC:${iban}`,am?`AM:${am}`:null,'CC:CZK',`RN:${safe(data.recipient,35)}`,`MSG:${safe('Podpora '+data.title,60)}`,data.vs?`X-VS:${data.vs}`:null].filter(Boolean).join('*');
}
