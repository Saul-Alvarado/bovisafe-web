import {test,expect} from '@playwright/test'
test('real OSM streets load with attribution inside official Guerrero boundaries',async({page})=>{
 test.skip(process.env.BOVISAFE_LIVE_TILES!=='1','Opt-in single real-provider check; ordinary tests stub images to respect OSM capacity')
 await page.goto('/');const map=page.locator('.operative-map');await map.scrollIntoViewIfNeeded();
 await expect.poll(()=>page.locator('.leaflet-tile-pane img').evaluateAll(images=>images.filter(i=>i.complete&&i.naturalWidth===256).length),{timeout:20000}).toBeGreaterThan(0);
 await expect(page.getByRole('link',{name:'© OpenStreetMap contributors'})).toBeVisible();
 await page.getByLabel('Municipio',{exact:true}).selectOption('12029');await expect.poll(async()=>Number(await map.getAttribute('data-zoom'))).toBeGreaterThan(8);
 await page.screenshot({path:'verification/real-osm-map.png',fullPage:true});
 await page.getByLabel('Municipio',{exact:true}).selectOption({label:'Acatepec'});await page.waitForTimeout(900);await expect.poll(()=>page.locator('.leaflet-tile-pane img').evaluateAll(images=>images.filter(i=>i.complete&&i.naturalWidth===256).length)).toBeGreaterThan(0);await page.screenshot({path:'verification/real-acatepec-map.png',fullPage:true});await page.getByRole('button',{name:'Restablecer vista completa',exact:true}).click();await page.waitForTimeout(900);await page.locator('.surveillance-map').screenshot({path:'verification/real-public-map.png'});
})
