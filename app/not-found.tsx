import Link from 'next/link';
export default function NotFound(){return <main className="wrap page-space"><div className="empty"><img src="/favicon.svg" alt="" width="64" height="64" style={{margin:'0 auto 25px'}}/><h1>Tady zatím nic neroste.</h1><p>Požadovaná stránka neexistuje nebo není zveřejněná.</p><Link className="btn" href="/">Zpět na úvod</Link></div></main>}
