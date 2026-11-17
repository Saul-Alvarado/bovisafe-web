import { test, expect } from '@playwright/test'
import fs from 'node:fs'
const fixturePath=process.env.BOVISAFE_E2E_FIXTURE
const fixture=fixturePath && fs.existsSync(fixturePath) ? JSON.parse(fs.readFileSync(fixturePath,'utf8')) : null
// No routes or API stubs: Vite proxies the actual Java backend and PostgreSQL.
test('live Android evaluation is queryable from React with its authenticated photograph',async({page})=>{
  test.skip(!fixture,'Requires the opt-in physical Android run and its private local fixture')
  const errors=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto('/')
  await page.getByRole('button',{name:'Acceder a mis registros',exact:true}).click()
  await page.getByLabel('Correo',{exact:true}).fill(fixture.email)
  await page.getByLabel('Contraseña',{exact:true}).fill(fixture.password)
  const loginResponse=page.waitForResponse(r=>r.url().endsWith('/api/auth/login') && r.request().method()==='POST')
  await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click()
  const token=(await (await loginResponse).json()).token
  await page.getByLabel('Origen del historial',{exact:true}).selectOption('TEST')
  await expect(page.getByRole('cell',{name:fixture.identifier,exact:false})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Guerrero, registro por registro'})).toBeVisible()
  await expect(page.locator('[data-metric="evaluations"]')).toHaveText('0')
  await expect(page.locator('.operational-marker')).toHaveCount(0)
  await page.getByRole('button',{name:'Ver',exact:true}).click()
  await expect(page.getByRole('heading',{name:`${fixture.identifier} · ${fixture.classification}`})).toBeVisible()
  await expect(page.getByText('Modelo: v1_experimental. Puntuaciones del clasificador; no son probabilidades clínicas.')).toBeVisible()
  const photo=page.getByRole('img',{name:'Fotografía de la evaluación',exact:true})
  await expect(photo).toBeVisible()
  await expect.poll(()=>photo.evaluate(el=>el.complete && el.naturalWidth>0)).toBeTruthy()
  const observed=await page.locator('.portal-report dl dt').allTextContents()
  expect(observed).toEqual(['NWS','HEALTHY','LESION','ENVIRONMENT','POOR_QUALITY','OCCLUSION'])
  await expect(page.getByRole('button',{name:'Registrar valoración y cerrar seguimiento'})).toHaveCount(0)
  await page.getByLabel('Observaciones',{exact:true}).fill('VERIFICACION E2E: registro sintético, no representa un caso clínico real.')
  const update=page.waitForResponse(r=>r.url().endsWith(`/api/evaluations/${fixture.evaluationId}/follow-up`) && r.request().method()==='PUT')
  await page.getByRole('button',{name:'Guardar seguimiento',exact:true}).click()
  expect((await update).ok()).toBeTruthy()
  const persisted=await page.request.get(`/api/evaluations/${fixture.evaluationId}`,{headers:{Authorization:`Bearer ${token}`}})
  expect((await persisted.json()).observations).toBe('VERIFICACION E2E: registro sintético, no representa un caso clínico real.')
  await expect(page.getByLabel('Observaciones',{exact:true})).toHaveValue('VERIFICACION E2E: registro sintético, no representa un caso clínico real.')
  expect(errors).toEqual([])
})
