import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={metadataBase:new URL('https://podporao.hdnenkshxbfje.chatgpt.site'),title:{default:'Podporao — Malá podpora, velké nápady',template:'%s | Podporao'},description:'Objevte české projekty a pomozte jim vyrůst. Dobrovolná podpora přímo autorům přes QR platbu.',openGraph:{title:'Podporao — Velké nápady rostou díky malé podpoře.',description:'Objevte české projekty a pomozte jim vyrůst.',locale:'cs_CZ',type:'website',images:[{url:'/images/hero.webp',width:1536,height:1024}]},icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="cs"><body>{children}</body></html>}
