import { faq, operatorPending, privacy, terms } from './legal';
export type ProjectData={title:string;category:string;summary:string;description:string;purpose:string;website:string;image:string;gallery:string[];recipient:string;account:string;vs:string;demo?:boolean};
export type User={id:string;name:string;email?:string;bio:string;website:string;ico:string;avatar:string;role:string;blocked:number};
export const labels:Record<string,string>={draft:'Koncept',pending:'Čeká na schválení',changes:'Vyžaduje úpravy',published:'Zveřejněno',rejected:'Zamítnuto',paused:'Pozastaveno',archived:'Archivováno'};
export const blank:ProjectData={title:'',category:'technologie',summary:'',description:'',purpose:'',website:'',image:'',gallery:[],recipient:'',account:'',vs:''};
export const defaultCategories=[{id:'technologie',name:'Technologie'},{id:'komunita',name:'Komunita'},{id:'tvorba',name:'Tvorba'},{id:'priroda',name:'Příroda'}];
export const defaults: Record<string, string> = {
 hero_title: 'Velké nápady rostou díky malé podpoře.',
 hero_subtitle: 'Objevte české projekty a pomozte jim vyrůst.',
 contact_email: 'info@podporao.cz',
 operator: operatorPending,
 footer: 'Prostor pro projekty, které dávají smysl.',
 cta_title: 'Máte nápad, který si zaslouží růst?',
 cta_subtitle: 'Představte svůj projekt komunitě a získejte její dobrovolnou podporu.',
 faq,
 terms,
 privacy,
};
export const demos = [
 {slug:'slevao',title:'Slevao — Chytřejší nákupy',summary:'Ukázka projektu pro objevování slev, letáků a inspirace k nákupům.',category:'technologie',image:'/images/slevao.webp'},
 {slug:'gurmao',title:'Gurmao — Objevujte podle chuti',summary:'Ukázka průvodce gastronomií a objevováním restaurací podle chuti.',category:'tvorba',image:'/images/gurmao.webp'},
 {slug:'opravao',title:'Opravao — Pomoc blízko vás',summary:'Ukázka projektu propojujícího lidi s opraváři a řemeslníky.',category:'komunita',image:'/images/opravao.webp'},
 {slug:'zahrada',title:'Komunitní zahrada',summary:'Ilustrační námět společného místa pro pěstování a setkávání sousedů.',category:'priroda',image:'/images/zahrada.webp'},
 {slug:'hra',title:'Česká desková hra',summary:'Ilustrační námět autorské hry s příběhem a dřevěnými figurkami.',category:'tvorba',image:'/images/hra.webp'},
 {slug:'lupin',title:'Lupin — Síla rostlin',summary:'Ukázka projektu zaměřeného na sladkou lupinu a rostlinné potraviny.',category:'priroda',image:'/images/lupin.webp'}
].map(x=>({...blank,...x,id:'demo-'+x.slug,demo:true,description:x.summary+'\n\nTato prezentace ukazuje možnosti platformy Podporao. Nejde o otevřenou výzvu k posílání peněz. Fotografie je vytvořená ilustrace.',purpose:'Ukázkový obsah bez aktivního přijímání příspěvků.'}));
