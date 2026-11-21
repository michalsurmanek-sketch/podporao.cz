#!/usr/bin/env node
// Uses the Supabase Management API. Never accepts or prints credentials as CLI arguments.
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const project = 'yqhfhpjthxcbbzdlisgt';
const origin = 'https://podporao.cz';
const redirects = ['/potvrzeni', '/obnova-hesla'].flatMap(path => [origin + path, 'https://www.podporao.cz' + path]);
const desired = {
  site_url: origin,
  mailer_subjects_confirmation: 'Potvrďte svůj e-mail | Podporao',
  mailer_subjects_recovery: 'Obnova hesla | Podporao',
  mailer_templates_confirmation_content: await readFile(new URL('../supabase/templates/confirmation.html', import.meta.url), 'utf8'),
  mailer_templates_recovery_content: await readFile(new URL('../supabase/templates/recovery.html', import.meta.url), 'utf8'),
};
const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => !['--check', '--dry-run', '--apply', '--help'].includes(arg))) {
  console.error('Použijte --check, --dry-run nebo --apply.'); process.exit(1);
}
if (args[0] === '--help') {
  console.log('node scripts/configure-supabase-auth.mjs [--check|--dry-run|--apply]\n--check: lokální ověření bez přístupu a změn (výchozí).\n--dry-run: porovná vzdálené nastavení, nic neukládá.\n--apply: uloží pouze šablony, Site URL a doplní přesné redirect URL.\nVzdálené režimy vyžadují SUPABASE_ACCESS_TOKEN v prostředí. SMTP se nemění.');
  process.exit(0);
}
for (const [kind, path, type] of [['confirmation', '/potvrzeni', 'signup'], ['recovery', '/obnova-hesla', 'recovery']]) {
  const html = desired[`mailer_templates_${kind}_content`];
  const links = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
  const action = links.filter(link => link.includes('.TokenHash'));
  assert.equal(action.length, 1);
  const url = new URL(action[0].replaceAll('{{ .SiteURL }}', origin).replaceAll('{{ .TokenHash }}', 'test-token').replaceAll('&amp;', '&'));
  assert.equal(url.origin, origin); assert.equal(url.pathname, path);
  assert.equal(url.searchParams.get('token_hash'), 'test-token'); assert.equal(url.searchParams.get('type'), type);
  assert.ok(html.includes('lang="cs"')); assert.ok(!/<script|<img|<form/i.test(html));
}
if (!args[0] || args[0] === '--check') {
  console.log('OK: obě české šablony, jednorázové tokeny, návratové cesty a přesné redirect URL. Nic nebylo uloženo v Supabase.');
  process.exit(0);
}
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) { console.error('Chybí SUPABASE_ACCESS_TOKEN v prostředí. Nic nebylo změněno.'); process.exit(1); }
const endpoint = `https://api.supabase.com/v1/projects/${project}/config/auth`;
async function request(method, body) {
  const response = await fetch(endpoint, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Supabase Management API: HTTP ${response.status}. Odpověď s konfigurací se z bezpečnostních důvodů nevypisuje.`);
  return response.json();
}
try {
  const current = await request('GET');
  // Keep existing integrations; add only exact production return paths.
  const existing = String(current.uri_allow_list || '').split(',').map(value => value.trim()).filter(Boolean);
  const patch = { ...desired, uri_allow_list: [...new Set([...existing, ...redirects])].join(',') };
  const changed = Object.keys(patch).filter(key => current[key] !== patch[key]);
  console.log(JSON.stringify({ project, changedFields: changed, siteURL: origin, addedRedirects: redirects.filter(url => !existing.includes(url)), existingRedirectsPreserved: existing.length, smtpChanged: false }, null, 2));
  if (args[0] !== '--apply') { console.log('Pouze porovnání. Nic nebylo změněno.'); process.exit(0); }
  if (changed.length) await request('PATCH', Object.fromEntries(changed.map(key => [key, patch[key]])));
  const actual = await request('GET');
  for (const key of Object.keys(patch)) assert.equal(actual[key], patch[key], `Neověřené pole: ${key}`);
  console.log('Uložení a zpětné načtení konfigurace ověřeno. Doručení e-mailů a SMTP je nutné ověřit samostatně.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Konfigurace nebyla ověřena.'); process.exitCode = 1;
}
