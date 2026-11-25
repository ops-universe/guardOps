import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const url=process.env.GUARDOPS_TEST_URL||'http://127.0.0.1:4173/guardOps/';
test.beforeEach(async({page})=>{await page.goto(url);await expect(page.getByRole('heading',{name:'Policy workbench'})).toBeVisible();});
test('real policy decisions, invalid input and stale evidence',async({page})=>{
 const work=page.getByRole('region',{name:'Policy dashboard'});
 const evaluate=work.getByRole('button',{name:'Evaluate decision'});
 const evidence=work.locator('pre');
 await evaluate.click();await expect(evidence).toContainText('"decision": "allow"');
 await work.getByLabel('Synthetic role').fill('guest');await expect(evidence).toContainText('Run a simulation');
 await evaluate.click();await expect(evidence).toContainText('"decision": "deny"');
 await work.getByLabel('Version 1 policy JSON').fill('{');await evaluate.click();await expect(evidence).toContainText('"decision": "deny"');
 await work.getByRole('button',{name:'Reset fixture'}).click();await expect(work.getByText('Valid policy',{exact:true})).toBeVisible();
 await work.getByLabel('Synthetic role').fill('support');await work.getByLabel('Arguments JSON').fill('{"id":"SKU1","admin":true}');await evaluate.click();await expect(evidence).toContainText('schema-mismatch');
});
test('synthetic approval queue never changes policy evidence',async({page})=>{
 const work=page.getByRole('region',{name:'Policy dashboard'});
 await work.getByLabel('Tool',{exact:true}).fill('refund');await work.getByRole('button',{name:'Evaluate decision'}).click();
 await expect(work.locator('pre')).toContainText('require-review');await work.getByRole('button',{name:'Approve demo'}).click();
 await expect(work.getByText('support / refund: approved-demo')).toBeVisible();await expect(work.getByRole('button',{name:'Reject demo'})).toBeDisabled();
 await expect(work.locator('pre')).toContainText('require-review');await work.getByLabel('Arguments JSON').fill('{}');await expect(work.getByText('No pending review.',{exact:false})).toBeVisible();
});
test('keyboard interaction and accessible workbench',async({page})=>{
 const work=page.getByRole('region',{name:'Policy dashboard'});
 await work.getByLabel('Synthetic role').focus();await page.keyboard.press('Tab');await expect(work.getByLabel('Tool',{exact:true})).toBeFocused();
 await page.keyboard.press('Tab');await expect(work.getByLabel('Arguments JSON')).toBeFocused();
 await page.keyboard.press('Tab');await expect(work.getByRole('button',{name:'Evaluate decision'})).toBeFocused();
 await page.keyboard.press('Enter');await expect(work.locator('pre')).toContainText('allow');
 const result=await new AxeBuilder({page}).include('#dashboard').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
 expect(result.violations).toEqual([]);
});
test('mobile layout and no external requests during simulation',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 const external=[];const origin=new URL(url).origin;page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==origin)external.push(r.url());});
 await page.reload();const work=page.getByRole('region',{name:'Policy dashboard'});
 await work.getByRole('button',{name:'Evaluate decision'}).click();await expect(work.locator('pre')).toContainText('allow');
 expect(await work.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);expect(external).toEqual([]);
});
