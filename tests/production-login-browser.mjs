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
 const errorBox=page.locator('.auth-panel [role="alert"]').first();
 await errorBox.waitFor({state:'visible',timeout:25000});
 const message=await errorBox.innerText();
 if(!message.trim())throw Error('Formulář nevrátil chybové upozornění');
 console.log('Login error visible:',message.slice(0,200));
 console.log('Browser page errors:',errors.slice(0,3));
 if(errors.length)throw Error('Frontend JavaScript error: '+errors.join(' | '));
}finally{await browser.close();}
