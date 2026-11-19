# Podporao

Česká platforma pro přímou dobrovolnou podporu projektů. TypeScript, React, Vinext/Vite, Tailwind, Cloudflare Workers, D1 (SQLite) a R2. Úvodní vizuál a šest samostatných obrázků jsou optimalizované do WebP. Produkční data nejsou v localStorage.

## Funkční rozsah

Veřejný katalog, hledání, kategorie, stránkování, redakční výběr, detail a profil autora, aktuality, hlášení. Autorský účet s pěti kroky, ukládáním konceptu, fotografiemi a historií. Administrace projektů, uživatelů, kategorií, hlášení, obsahu a zásahů. Serverové oprávnění autor/moderátor/admin, kontrola blokace na každé operaci, privátní fotografie konceptů, schválené veřejné verze, okamžité vypnutí plateb při změně příjemce/účtu/VS. Skutečné SPAYD QR s kontrolou českého účtu, IBAN a haléřů. Ukázky jsou v kódu oddělené a nikdy nepřijímají platby.

## Spuštění

Node 24+, `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. Spravované prostředí používá dodané Sites helpery. Standardní `npm run dev` spouští lokální Vite; testovací databázi připravte migrací podle následujícího odstavce.

## Databáze a soubory

Manifest `.openai/hosting.json` deklaruje `DB` a `BUCKET`. Hosting poskytuje perzistentní D1 a R2 a aplikuje migrace v `drizzle/` před nasazením. Nezasahujeme do jiných existujících Supabase projektů.

Lokální databáze: po sestavení spusťte:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_abandoned_randall_flagg.sql
```

Migraci přehrajte pouze do prázdné lokální databáze. Další změny: upravte `db/schema.ts`, spusťte `npm run db:generate`, prohlédněte SQL. Aplikované migrace neměňte. D1 nepoužívá PostgreSQL RLS: bezpečnost zajišťují serverové kontroly jednotlivých operací. Klient nemá přímý přístup do D1 ani R2.

## Identita a první správce

Původní soukromý náhled používal hostované Sign in with ChatGPT. Při nakonfigurovaném Supabase Auth je tato identita záměrně ignorována. Pokud Supabase není aktivní, náhled může využívat pouze hostingem důvěryhodně vložené identitní hlavičky. Samostatný Worker nesmí být veřejně dostupný bez vrstvy, která tyto hlavičky odstraní a bezpečně ověří identitu. Na jiném hostingu tyto hlavičky nikdy nepřebírejte od klienta; použijte pouze ověřené Supabase účty.

Po prvním přihlášení získejte své přesné `user.id` z `/api/v1/me` a nastavte serverovou proměnnou `ADMIN_USER_ID` na tuto hodnotu. Pro veřejný provoz používejte výhradně stabilní `ADMIN_USER_ID`, ideálně `supabase:<UUID>` z ověřeného uživatelského účtu. Nepřidělujte roli pouze podle e-mailové adresy: při špatném nastavení ověřování e-mailu by to mohlo umožnit převzetí administrace. První návštěvník se nikdy automaticky nestává administrátorem. Proměnnou přidělujte pouze ověřenému provozovateli. Formát je `sites:<stabilní ID>` nebo `supabase:<UUID>`. Další role přiděluje administrátor. Vlastní účet nelze z administrace zablokovat ani mu odebrat roli.

## E-mailové účty přes Supabase

Pro projekt Podporao je v kódu již nastavena výchozí URL a nízkooprávněný veřejný publishable klíč existujícího Supabase projektu. Produkční serverové proměnné `SUPABASE_URL` a `SUPABASE_PUBLISHABLE_KEY` mají přednost při přepsání nastavení. Připravené jsou skutečné serverové REST integrace: registrace, ověření, přihlášení, obnova, změna hesla, refresh a odhlášení. Tokeny zůstávají v HttpOnly, Secure, SameSite=Lax cookies. Role se ukládají v D1 a nikdy se nepřebírají z uživatelsky upravitelných Supabase metadata. Server vždy ověřuje token u `/auth/v1/user`.

V Supabase zapněte potvrzování e-mailu, nastavte Site URL na skutečnou doménu a povolte redirect URL pro `/potvrzeni` a `/obnova-hesla`. V šablonách e-mailů použijte vlastní potvrzovací odkazy:

- registrace: `{{ .SiteURL }}/potvrzeni?token_hash={{ .TokenHash }}&type=signup`
- obnova: `{{ .SiteURL }}/obnova-hesla?token_hash={{ .TokenHash }}&type=recovery`

Bez úpravy Site URL, povolených redirect URL a šablon v dashboardu Supabase nelze potvrdit funkční e-mailové odkazy. Odkaz je po úspěšném ověření odstraněn z adresního řádku. Supabase projekt ani placené prostředky se nevytvářejí automaticky. D1 zůstává databází aplikace; přidání Supabase Auth samo nepřesouvá data do PostgreSQL. Změna identity mezi Sites a Supabase nevytváří automatické propojení účtů.

## E-mailová oznámení

Nastavte `RESEND_API_KEY` a `EMAIL_FROM` s ověřenou odesílací doménou. Bez nich se oznámení ukládají s příznakem `inactive` a jsou viditelná v účtu autora. Nezobrazujeme je jako odeslané. Chyba poskytovatele je `failed`, úspěšné přijetí poskytovatelem `sent` (nikoli důkaz doručení do schránky).

## Platby

Formát dle https://qr-platba.cz/pro-vyvojare/specifikace-formatu/. Knihovna `qrcode` vytváří PNG, test ho dekóduje pomocí `jsqr`. Platby jsou povolené až po schválení vyplněného projektu. Platforma nikdy neposílá peníze ani nepotvrzuje jejich přijetí. Zobrazení a vytvoření QR jsou samostatné provozní metriky. Číslo účtu v unit testech je pouze testovací vektor standardu, nikdy se nezobrazuje v živém projektu.

## Ověření

`npm test`: kontrolní součty a normalizace účtu/IBAN, přesné částky, chyby vstupů, SPAYD a dekódování QR; dále celý serverový workflow s reálným SQLite v paměti a testovacím adaptérem D1/R2: dva autoři, anonym, správce, oprávnění, neveřejné fotografie, schválení, zachování veřejné verze, zmrazení plateb, optimistické zamykání, hlášení, blokace, pozastavení a obnova. Vnější služby Supabase a Resend nejsou bez přístupů testované živě. Testovací adaptéry se nenasazují do aplikace.

## Před veřejným spuštěním

Doplňte skutečného provozovatele, kontaktní e-mail a právně zkontrolované podmínky a soukromí (v administraci). Připojte a ověřte e-mailové služby, chcete-li používat e-mailové účty. Schvalujte pouze projekty se skutečnými údaji a oprávněně použitými fotografiemi. Doména podporao.cz není tímto repozitářem automaticky připojena. Výchozí náhled je soukromý. Není implementováno napojení na banku, provize ani automatické párování příspěvků — platforma je neslibuje.

## Stav produkčního propojení (19. 11. 2026)

Repozitář nyní používá Supabase Auth projekt `www.podporao.cz` pro registraci, přihlášení a obnovu hesla. Veřejný publishable klíč nedává privilegovaný přístup k databázi; tajné klíče do repozitáře nepatří. Údaje autorů, projektů, hlášení, rolí a auditní záznamy zůstávají v aplikační D1, fotografie v R2. Provozní údaje nemažte ani nemigrujte bez zálohy a ověření nasazení.

`info@podporao.cz` je příchozí pošta na Cloudflare Email Routing přeposílaná do ověřené schránky, což samo o sobě neověřuje odesílání přes Supabase nebo Resend.

**Zprovoznění prvního admina:** Zaregistrujte na veřejném webu účet, potvrďte e-mail v Supabase Auth, v Supabase dashboardu otevřete jeho `auth.users.id` a nastavte na serverovém hostingu `ADMIN_USER_ID=supabase:<UUID>`. Restartujte nasazení, přihlaste se tímto účtem a otestujte `/administrace`. E-mail samotný admina nikdy automaticky nevytváří. Chybějící možnost konfigurace Sites hostingu blokuje dokončení tohoto kroku z GitHubu.

**Zbývající externí nastavení:** Supabase Auth URL Configuration nastavte Site URL `https://podporao.cz`, přesné redirect URL `https://podporao.cz/potvrzeni`, `https://podporao.cz/obnova-hesla`; zapněte potvrzování e-mailů a nastavte odpovídající e-mailové šablony dle výše. V Supabase nakonfigurujte produkční SMTP, ověřte odeslání potvrzovacího e-mailu. Pro oznámení autorům nastavte na hostingu Resend `RESEND_API_KEY` a `EMAIL_FROM=Podporao <info@podporao.cz>` po ověření odesílací domény. Žádný z těchto tajných klíčů nezapisujte do Gitu. Otestujte end-to-end uživatele, QR a audit.
