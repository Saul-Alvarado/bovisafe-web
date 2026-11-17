import { test, expect } from '@playwright/test'
import { snapshot,point } from './fixtures/observatory.js'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import fs from 'node:fs'
const state=JSON.parse(fs.readFileSync('public/geo/guerrero-catalog.json','utf8')).state.features[0]
async function mock(page,mode='empty'){
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),path=url.pathname
  if(path==='/api/auth/login')return route.fulfill({json:{farmerId:1,firstName:'FIXTURE',token:'fixture-token'}})
  if(path==='/api/evaluations'||path==='/api/clinical/evaluations')return route.fulfill({json:[]})
  if(path.startsWith('/api/observatory')){
   if(mode==='error')return route.fulfill({status:503,json:{message:'Servidor temporalmente no disponible'}})
   const authorized=path.endsWith('/authorized'),empty=url.searchParams.get('category')==='HEALTHY'||url.searchParams.get('from')==='2026-11-03'||url.searchParams.get('municipality')==='12001'
   const count=mode==='empty'||empty?0:2,features=mode==='missing'?[]:count?[point]:[]
   return route.fulfill({json:snapshot({authorized,count,features,unlocated:mode==='missing'?1:0})})
  }
  return route.fulfill({status:404,json:{message:'Fixture no configurado'}})
 })
 await page.goto('/')
 await expect(page.locator('.operative-map')).toBeVisible()
}
async function login(page){
 await page.getByRole('button',{name:'Acceder a mis registros',exact:true}).click()
 await page.getByLabel('Correo',{exact:true}).fill('fixture@test.invalid');await page.getByLabel('Contraseña',{exact:true}).fill('fixture-password')
 await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByLabel('Origen del historial',{exact:true})).toBeVisible()
}
test('A: empty database shows Guerrero and zero without synthetic markers',async({page})=>{
 await mock(page)
 await expect(page.locator('[data-metric="evaluations"]')).toHaveText('0')
 await expect(page.locator('[data-metric="ranches"]')).toHaveText('0')
 await expect(page.locator('.operational-marker')).toHaveCount(0)
 await expect(page.getByText('Actualmente no hay evaluaciones registradas para el periodo seleccionado.')).toBeVisible()
 await expect(page.locator('#obs-municipality option')).toHaveCount(86)
 await expect(page.getByRole('button',{name:/demostración/i})).toHaveCount(0)
 await page.screenshot({path:'verification/map-empty.png',fullPage:true})
})
test('B: exact authorized point and public aggregates stay separate',async({page})=>{
 await mock(page,'data');await expect(page.locator('[data-metric="evaluations"]')).toHaveText('2');await expect(page.locator('.operational-marker')).toHaveCount(0);expect((await page.locator('.bar-track i').boundingBox()).height).toBeGreaterThan(100)
 await login(page);await expect(page.locator('.operational-marker')).toHaveCount(1);await page.locator('.operational-marker').click()
 await expect(page.getByText('FIXTURE SOLO PRUEBA',{exact:true})).toBeVisible();await expect(page.getByText('2 evaluaciones',{exact:true})).toBeVisible()
})
test('C: missing coordinates keep counts without an invented marker',async({page})=>{
 await mock(page,'missing');await login(page);await expect(page.locator('[data-metric="evaluations"]')).toHaveText('2');await expect(page.locator('.operational-marker')).toHaveCount(0)
 await expect(page.getByText(/1 ranchos evaluados sin coordenadas válidas/)).toBeVisible()
})
test('D: date, category, municipality and reset update all indicators together',async({page})=>{
 await mock(page,'data');await expect(page.locator('[data-metric="evaluations"]')).toHaveText('2')
 await page.getByLabel('Clasificación',{exact:true}).selectOption('HEALTHY');await expect(page.locator('[data-metric="evaluations"]')).toHaveText('0');await expect(page.getByRole('button',{name:'2026-11: 0 evaluaciones'})).toBeVisible()
 await page.getByRole('button',{name:'Restablecer filtros',exact:true}).click();await expect(page.locator('[data-metric="evaluations"]')).toHaveText('2')
 await page.getByLabel('Municipio',{exact:true}).selectOption('12001');await expect(page.locator('[data-metric="evaluations"]')).toHaveText('0')
 await page.getByRole('button',{name:'Restablecer filtros',exact:true}).click();await page.getByLabel('Desde',{exact:true}).fill('2026-11-03');await expect(page.locator('[data-metric="evaluations"]')).toHaveText('0')
})
test('E: backend failure preserves geography, clears stale data and permits retry',async({page})=>{
 await mock(page,'error');await expect(page.getByRole('alert')).toContainText('Servidor temporalmente no disponible');await expect(page.locator('.operative-map')).toBeVisible();await expect(page.locator('.operational-marker')).toHaveCount(0);await expect(page.locator('[data-metric="evaluations"]')).toHaveText('—')
 await page.unroute('**/api/**');await page.route('**/api/observatory**',route=>route.fulfill({json:snapshot()}));await page.getByRole('button',{name:'Reintentar consulta',exact:true}).click();await expect(page.locator('[data-metric="evaluations"]')).toHaveText('0')
})
test('F: wheel, controls, drag and responsive resize keep the actual geography interactive',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await mock(page,'data');const map=page.locator('.operative-map');await map.scrollIntoViewIfNeeded();await expect(map).toHaveAttribute('data-zoom',/.+/)
 const initial=Number(await map.getAttribute('data-zoom'));await map.hover();await page.mouse.wheel(0,-500);await expect.poll(async()=>Number(await map.getAttribute('data-zoom'))).toBeGreaterThan(initial)
 const rect=await map.boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(rect.x+rect.width-8,rect.y+30,{steps:15});await page.mouse.up()
 await page.getByRole('button',{name:'Restablecer vista completa',exact:true}).click();await expect.poll(async()=>Number(await map.getAttribute('data-zoom'))).toBeCloseTo(initial,0)
 await page.getByLabel('Región declarada',{exact:true}).selectOption('SIERRA');await expect(page.getByLabel('Región declarada',{exact:true})).toHaveValue('SIERRA')
 await page.setViewportSize({width:390,height:844});await expect(map).toBeVisible();await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy()
 await page.screenshot({path:'verification/map-mobile.png',fullPage:true});expect(errors).toEqual([])
})
test('chart bars and category segments are functional filters',async({page})=>{
 await mock(page,'data');await page.getByRole('button',{name:'2026-11: 2 evaluaciones',exact:true}).click();await expect(page.getByLabel('Mes',{exact:true})).toHaveValue('2026-11');await page.getByRole('button',{name:'HEALTHY 0',exact:true}).click();await expect(page.locator('[data-metric="evaluations"]')).toHaveText('0')
})


test('many authorized ranches cluster without fabricating points',async({page})=>{
 await page.route('**/api/**',route=>{
  const path=new URL(route.request().url()).pathname
  if(path==='/api/auth/login')return route.fulfill({json:{farmerId:1,token:'fixture-token'}})
  if(path.includes('/observatory')){
   const features=Array.from({length:25},(_,i)=>({...point,properties:{...point.properties,ranch_id:i+1,ranch_name:'TEST '+i},geometry:{type:'Point',coordinates:[-99.5+i*.00001,17.55]}}))
   return route.fulfill({json:snapshot({authorized:path.endsWith('/authorized'),count:2,features})})
  }
  return route.fulfill({json:[]})
 })
 await page.goto('/');await login(page);await expect(page.locator('.marker-cluster')).toHaveCount(1);await expect(page.locator('.marker-cluster')).toHaveText('25');await page.locator('.marker-cluster').click();await expect(page.locator('.operative-map')).toBeVisible()
})
