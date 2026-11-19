import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://podporao.cz/prihlaseni',{waitUntil:'domcontentloaded',timeout:30000});
 const button=page.getByRole('button',{name:'Přihlásit se e-mailem'});
 await button.waitFor({state:'visible',timeout:25000});
 await page.waitForTimeout(1500);
 if(!(await button.isEnabled()))throw Error('Přihlašovací tlačítko je zakázané');
 console.log('Login button enabled: yes');
 await page.getByRole('textbox',{name:'E-mail'}).fill('smoke-unregistered@example.invalid');
 await page.locator('input[type=password]').fill('totally-incorrect-password');
 await button.click();
 const errorBox=page.locator('.auth-panel .error,.auth-panel [role=alert],.auth-panel .alert.error,.auth-panel .error-box').first();
 await page.waitForFunction(()=>document.querySelector('.auth-panel')?.textContent?.includes('Neplatné přihlašovací údaje')||document.querySelector('.auth-panel')?.textContent?.includes('Invalid login credentials')||document.querySelector('.auth-panel')?.querySelector('.error-box, .error')?.textContent?.trim(),{timeout:20000}).catch(()=>{});
 const displayed=await page.locator('.auth-panel').innerText();
 if(!/Neplatn|Invalid login|Požadavek|přihlášení|email|hesl|wrong|credentials/i.test(displayed)||displayed.includes('Zpracovávám…'))throw Error('Formulář neodpověděl na odeslání');
 console.log('Login form reacted:',displayed.slice(-220));
 console.log('Browser page errors:',errors.slice(0,3));
 if(errors.length)throw Error('Frontend JavaScript error: '+errors.join(' | '));
}finally{await browser.close();}
