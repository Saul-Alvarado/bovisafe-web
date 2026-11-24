import {test,expect} from '@playwright/test'
import {snapshot,point} from './fixtures/observatory.js'
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXZkAAAAASUVORK5CYII=','base64')
const ranches=[
 [11,'RANCHO CONTROLADO · SIN ALERTAS',[-99.5,17.55],12,8,0,0,0],
 [12,'RANCHO CONTROLADO · COMPATIBILIDAD',[-99.88,16.86],9,4,2,0,0],
 [13,'RANCHO CONTROLADO · SOSPECHA',[-101.55,17.64],10,6,0,1,0],
 [14,'RANCHO CONTROLADO · CONFIRMACIÓN',[-99.54,18.34],5,3,0,0,2],
].map(([id,name,coordinates,registered,animals,nws,suspected,confirmed])=>({...point,id,geometry:{type:'Point',coordinates},properties:{...point.properties,ranch_id:id,ranch_name:name,municipality_name:'Municipio de la prueba',registered_animals:registered,animals,evaluations:animals+(nws?1:0),closed_cases:confirmed,nws_predictions:nws?3:0,nws_animals:nws,suspected_cases:suspected,suspected_animals:suspected,confirmed_cases:confirmed,confirmed_animals:confirmed,follow_up_cases:suspected+nws,follow_up_animals:suspected+nws,last_evaluation_at:'2026-11-17T06:20:00'}}))
async function prepare(page,{publicView=false,empty=false}={}){
 await page.route('https://tile.openstreetmap.org/**',r=>r.fulfill({contentType:'image/png',body:png}))
 await page.route('**/api/**',route=>{
  const url=new URL(route.request().url()),path=url.pathname
  if(path==='/api/auth/login')return route.fulfill({json:{farmerId:1,token:'fixture-token'}})
  if(path.includes('/observatory')){
   const authorized=path.endsWith('/authorized'),zero=empty||url.searchParams.get('category')==='HEALTHY',data=snapshot({authorized,count:zero?0:22,features:zero?[]:ranches})
   data.summary={...data.summary,registered_animals:zero?0:36,animals:zero?0:21,ranches:zero?0:4,nws_predictions:zero?0:3,suspected_cases:zero?0:1,follow_up_cases:zero?0:3,closed_cases:zero?0:2,nws_animals:zero?0:2,confirmed_cases:zero?0:2}
   if(!zero)data.municipalities=[{...data.summary,code:'12029',name:'Chilpancingo de los Bravo',ranches:4,nws_predictions:3,suspected_cases:1,confirmed_cases:2,nws_animals:2,confirmed_animals:2}]
   data.trend=[{...data.summary,month:'2026-11'}]
   data.categories=[{category:'NWS',count:zero?0:3},{category:'HEALTHY',count:zero?0:19},{category:'LESION',count:0}]
   data.caseStates=zero?[]:[{status:'PENDING_REVIEW',count:2},{status:'SUSPECTED',count:1},{status:'CLOSED',count:2}]
   data.publicMarkerMinimumRanches=1
   if(url.searchParams.has('municipality'))data.territorial={...data,map:{...data.map}}
   return route.fulfill({json:data})
  }
  return route.fulfill({json:[]})
 })
 await page.goto('/')
 if(!publicView){await page.getByRole('button',{name:'Acceder a mis registros',exact:true}).click();await page.getByLabel('Correo',{exact:true}).fill('fixture@test.invalid');await page.getByLabel('Contraseña',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click()}
 await expect(page.locator('.operative-map')).toBeVisible();await page.locator('.operative-map').scrollIntoViewIfNeeded()
}
async function capture(page,name){await page.evaluate(()=>{if(!document.getElementById('fixture-watermark')){const label=document.createElement('div');label.id='fixture-watermark';label.textContent='ENTORNO DE PRUEBAS · DATOS CONTROLADOS';label.style.cssText='position:fixed;bottom:8px;left:8px;z-index:10000;padding:6px 10px;background:#173f35;color:white;font:11px sans-serif;border-radius:5px;pointer-events:none';document.body.append(label)}});await page.screenshot({path:`verification/${name}.png`,fullPage:true});await page.locator('.surveillance-map').evaluate(el=>{if(!el.querySelector('.fixture-map-watermark')){const mark=document.createElement('span');mark.className='fixture-map-watermark';mark.textContent='PRUEBA · DATOS CONTROLADOS';mark.style.cssText='position:absolute;right:8px;bottom:4px;font:9px sans-serif;color:#325f45;z-index:1000';el.append(mark)}});await page.locator('.surveillance-map').screenshot({path:`verification/${name}-map.png`})}
test('A: empty official map stays free of livestock markers',async({page})=>{await prepare(page,{empty:true,publicView:true});await expect(page.locator('.operational-marker')).toHaveCount(0);await expect(page.getByText('Actualmente no hay evaluaciones registradas para el periodo seleccionado.')).toBeVisible();await capture(page,'redesign-empty')})
test('B C D E: ranches and bovine cohorts are drawn directly on the map',async({page})=>{
 await prepare(page);await expect(page.locator('.livestock-pin')).toHaveCount(4);await expect(page.locator('.livestock-pin.tone-visual')).toHaveCount(1);await expect(page.locator('.livestock-pin.tone-suspected')).toHaveCount(1);await expect(page.locator('.livestock-pin.tone-confirmed')).toHaveCount(1)
 await expect(page.locator('.livestock-pin.tone-registered .livestock-count')).toHaveText('12');await expect(page.locator('.livestock-pin.tone-confirmed .herd-cohort.tone-confirmed b')).toHaveText('2');await expect(page.locator('.livestock-pin.tone-confirmed .herd-cohort.tone-confirmed svg')).toHaveCount(3)
 await page.locator('.livestock-pin.tone-visual').click();await expect(page.getByLabel('Detalle del rancho')).toContainText('2bovinos con evaluación compatible');await expect(page.getByLabel('Detalle del rancho')).toContainText('no son posiciones GPS individuales');await expect(page.getByRole('button',{name:'Consultar evaluaciones',exact:true})).toBeVisible();await capture(page,'redesign-private')
 await page.locator('.livestock-pin.tone-confirmed').click();await expect(page.getByLabel('Detalle del rancho')).toContainText('Diagnóstico veterinario confirmado');await capture(page,'redesign-confirmed')
})
test('public livestock aggregate never reveals ranch names or exact points',async({page})=>{
 await prepare(page,{publicView:true});await expect(page.locator('.livestock-pin')).toHaveCount(1);await expect(page.locator('.aggregate-symbol')).toHaveText('M');await page.locator('.livestock-pin').click();await expect(page.getByLabel('Detalle municipal')).toContainText('AGREGADO MUNICIPAL');await expect(page.getByText(/RANCHO CONTROLADO/)).toHaveCount(0);await expect(page.getByRole('button',{name:'Consultar evaluaciones',exact:true})).toHaveCount(0);await capture(page,'redesign-public')
})
test('F G: sanitary filters remove all alerts and stale selected ranch',async({page})=>{await prepare(page);await page.locator('.livestock-pin.tone-visual').click();await page.getByLabel('Clasificación',{exact:true}).selectOption('HEALTHY');await expect(page.locator('.livestock-pin')).toHaveCount(0);await expect(page.getByLabel('Detalle del rancho')).toHaveCount(0);await expect(page.locator('[data-metric="evaluations"]')).toHaveText('0')})
test('H I: Acatepec viewport mask and mobile layout remain valid without recoloring other municipalities',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await prepare(page)
 const colored=async()=>page.locator('.operative-map .leaflet-overlay-pane path[fill="#d45e50"]').first().getAttribute('fill');const before=await colored()
 await page.getByLabel('Municipio',{exact:true}).selectOption({label:'Acatepec'});await expect(page.getByLabel('Detalle municipal')).toContainText('Acatepec');await expect.poll(colored).toBe(before)
 const mask=await page.locator('.operative-map').evaluate(el=>({width:Number(el.querySelector('.state-viewport-mask').getAttribute('width')),viewport:el.clientWidth,path:el.querySelector('.state-viewport-mask path').getAttribute('d')}));expect(mask.width).toBeGreaterThanOrEqual(mask.viewport);expect(mask.width).toBeLessThanOrEqual(mask.viewport*2+2);expect(mask.path).not.toMatch(/NaN|Infinity/);await capture(page,'redesign-acatepec')
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Restablecer vista completa',exact:true}).click();await expect.poll(async()=>page.locator('.operative-map').evaluate(el=>el.dataset.stateFits==='true')).toBeTruthy();await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();await expect(page.locator('.marker-cluster')).toHaveClass(/tone-confirmed/);await expect(page.locator('.cluster-herd b')).toHaveText('36');expect(await page.locator('.marker-cluster').evaluate(el=>getComputedStyle(el).getPropertyValue('--pin').trim())).toBe('#b0443c');await capture(page,'redesign-mobile');expect(errors).toEqual([])
})
