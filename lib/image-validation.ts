const MAX_DIMENSION=8192,MAX_PIXELS=20_000_000;
const bad=()=>{throw Error('Obrázek je poškozený nebo nemá podporovaný formát.');};
function dimensions(width:number,height:number){if(!width||!height||width>MAX_DIMENSION||height>MAX_DIMENSION||width*height>MAX_PIXELS)throw Error('Obrázek smí mít nejvýše 8192 px na stranu a 20 milionů pixelů.');return {width,height};}
const ascii=(b:Uint8Array,start:number,length:number)=>String.fromCharCode(...b.slice(start,start+length));
function crc32(bytes:Uint8Array){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
/** Validate complete container framing, dimensions and PNG CRCs before writing any object. */
export function validateImage(b:Uint8Array):{mime:string;width:number;height:number}{
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 if(b.length>=33&&ascii(b,1,3)==='PNG'&&b[0]===137&&ascii(b,4,4)==='\r\n\x1a\n'){
  let at=8,size:{width:number;height:number}|undefined,hasData=false,ended=false;
  while(at+12<=b.length){const length=v.getUint32(at),type=ascii(b,at+4,4),end=at+12+length;if(end>b.length)bad();if(crc32(b.subarray(at+4,at+8+length))!==v.getUint32(at+8+length))bad();
   if(!size){if(type!=='IHDR'||length!==13)bad();size=dimensions(v.getUint32(at+8),v.getUint32(at+12));if(b[at+18]!==0||b[at+19]!==0||b[at+20]>1)bad();}
   else if(type==='IHDR')bad();if(type==='IDAT'){if(!length)bad();hasData=true;}at=end;
   if(type==='IEND'){if(length!==0||at!==b.length)bad();ended=true;break;}
  }
  if(!ended||!hasData||!size)bad();return {mime:'image/png',...size!};
 }
 if(b.length>=16&&b[0]===255&&b[1]===216){
  if(b[b.length-2]!==255||b[b.length-1]!==217)bad();let at=2,size:{width:number;height:number}|undefined,sos=false;
  while(at<b.length-2){if(b[at++]!==255)bad();while(b[at]===255)at++;const marker=b[at++];if(marker===217)break;if(marker===1||(marker>=208&&marker<=215))continue;if(at+2>b.length)bad();const length=v.getUint16(at);if(length<2||at+length>b.length)bad();
   if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){if(length<8)bad();size=dimensions(v.getUint16(at+5),v.getUint16(at+3));}
   if(marker===218){sos=true;break;}at+=length;
  }
  if(!size||!sos)bad();return {mime:'image/jpeg',...size!};
 }
 if(b.length>=20&&ascii(b,0,4)==='RIFF'&&ascii(b,8,4)==='WEBP'){
  if(v.getUint32(4,true)+8!==b.length)bad();let at=12,size:{width:number;height:number}|undefined,hasImage=false;
  const u24=(n:number)=>b[n]|b[n+1]<<8|b[n+2]<<16;
  while(at+8<=b.length){const type=ascii(b,at,4),length=v.getUint32(at+4,true),data=at+8;if(data+length>b.length)bad();
   if(type==='VP8X'){if(length!==10||b[data]&2)bad();size=dimensions(1+u24(data+4),1+u24(data+7));}
   if(type==='VP8 '){if(length<10||ascii(b,data+3,3)!=='\x9d\x01\x2a')bad();const actual=dimensions(v.getUint16(data+6,true)&16383,v.getUint16(data+8,true)&16383);if(!size)size=actual;hasImage=true;}
   if(type==='VP8L'){if(length<5||b[data]!==47)bad();const bits=v.getUint32(data+1,true);const actual=dimensions(1+(bits&16383),1+((bits>>>14)&16383));if(!size)size=actual;hasImage=true;}
   if(type==='ANIM'||type==='ANMF')bad();at=data+length+(length%2);
  }
  if(at!==b.length||!hasImage||!size)bad();return {mime:'image/webp',...size!};
 }
 return bad();
}
