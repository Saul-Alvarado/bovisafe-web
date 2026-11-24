import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { snapshot, point } from './fixtures/observatory.js'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXZkAAAAASUVORK5CYII=', 'base64')
const catalog = JSON.parse(fs.readFileSync('public/geo/guerrero-catalog.json', 'utf8'))
const zero = { registered_ranches: 0, registered_animals: 0, evaluated_ranches: 0, animals: 0, evaluations: 0, nws_predictions: 0, nws_animals: 0, suspected_animals: 0, confirmed_animals: 0, follow_up_animals: 0, suspected_cases: 0, confirmed_cases: 0, follow_up_cases: 0, closed_cases: 0 }
const active = { registered_ranches: 3, registered_animals: 17, evaluated_ranches: 1, animals: 2, evaluations: 5, nws_predictions: 3, nws_animals: 1, suspected_animals: 0, confirmed_animals: 1, follow_up_animals: 1, suspected_cases: 0, confirmed_cases: 1, follow_up_cases: 1, closed_cases: 1 }
const unlocated = { code: 'UNLOCATED', name: 'Sin municipio verificado', regions: [], ...zero, registered_ranches: 1, registered_animals: 2 }
function municipalReport(url) {
  const municipality = url.searchParams.get('municipality')
  const rows = catalog.municipalities.features.map(f => ({ code: f.properties.code, name: f.properties.name, regions: f.properties.code === '12029' ? ['CENTRO'] : [], ...(f.properties.code === '12029' ? active : zero) }))
    .filter(r => !municipality || r.code === municipality).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const totals = { ...active, registered_ranches: 4, registered_animals: 19 }
  return { scope: 'PUBLIC_AGGREGATED', from: url.searchParams.get('from') || '2026-11-01', to: url.searchParams.get('to') || '2026-11-24', generatedAt: '2026-11-24T12:00:00Z', rows, unlocated: municipality ? null : unlocated, totals: municipality ? active : totals, criteria: 'Registros OPERATIONAL; TEST excluidos.' }
}
const ranchRows = [
  { ranch_id: 7, ranch_name: '=HYPERLINK("http://malicioso")', municipality_code: '12029', municipality_name: 'Chilpancingo de los Bravo', region: 'CENTRO', access: 'OWNER', active: true, ...active, registered_animals: 12, last_evaluation_at: '2026-11-17T06:20:00Z' },
  { ranch_id: 8, ranch_name: 'Rancho Sin Evaluaciones', municipality_code: '12076', municipality_name: 'Acatepec', region: null, access: 'VETERINARIAN', active: true, ...zero, registered_animals: 5, last_evaluation_at: null },
]
async function mock(page, { failMunicipal = false } = {}) {
  const calls = []
  await page.route('https://tile.openstreetmap.org/**', r => r.fulfill({ contentType: 'image/png', body: png }))
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()), path = url.pathname, auth = route.request().headers().authorization
    calls.push({ path, auth, query: url.search })
    if (path === '/api/auth/login') return route.fulfill({ json: { farmerId: 1, firstName: 'Fixture', token: 'fixture-token' } })
    if (path === '/api/evaluations' || path === '/api/clinical/evaluations') return route.fulfill({ json: [] })
    if (path.startsWith('/api/observatory')) return route.fulfill({ json: snapshot({ authorized: path.endsWith('/authorized'), count: 2, features: [point] }) })
    if (path === '/api/reports/municipalities') return failMunicipal ? route.fulfill({ status: 500, json: { message: 'Fallo controlado del reporte' } }) : route.fulfill({ json: municipalReport(url) })
    if (path === '/api/reports/ranches') {
      if (auth !== 'Bearer fixture-token') return route.fulfill({ status: 401, json: { message: 'Inicia sesión nuevamente' } })
      return route.fulfill({ json: { scope: 'AUTHORIZED_ONLY', from: '2026-11-01', to: '2026-11-24', generatedAt: '2026-11-24T12:00:00Z', rows: ranchRows, totals: { ...active, registered_animals: 17, registered_ranches: 2 } } })
    }
    return route.fulfill({ status: 404, json: { message: 'Fixture no configurado' } })
  })
  return calls
}
async function openReports(page) {
  await page.goto('/')
  await page.locator('#reportes').scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading', { name: 'Reportes y exportación', exact: true })).toBeVisible()
}
async function download(page) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar CSV', exact: true }).click()])
  return { name: file.suggestedFilename(), text: fs.readFileSync(await file.path(), 'utf8') }
}

test('public municipal report lists 85 municipalities, Guerrero totals and exports a safe CSV', async ({ page }) => {
  const calls = await mock(page)
  await openReports(page)
  const table = page.getByRole('region', { name: 'Tabla del reporte municipal' })
  await expect(table.locator('tbody tr')).toHaveCount(86)
  await expect(table.locator('tbody tr', { hasText: 'Sin municipio verificado' })).toHaveCount(1)
  await expect(table.locator('tfoot')).toContainText('Total Guerrero')
  await expect(table.locator('tfoot [data-total="evaluations"]')).toHaveText('5')
  await expect(table.locator('tfoot [data-total="registered_animals"]')).toHaveText('19')
  await expect(table.locator('thead')).toContainText('Evaluados')
  await expect(table.locator('thead')).toContainText('Evaluaciones')
  const { name, text } = await download(page)
  expect(name).toMatch(/^bovisafe_reporte-municipal_2026-11-01_.*\.csv$/)
  expect(text.charCodeAt(0)).toBe(0xFEFF)
  const lines = text.slice(1).split('\r\n')
  expect(lines[0]).toBe('Clave INEGI,Municipio,Región declarada,Ranchos registrados,Bovinos registrados,Bovinos evaluados (únicos),Evaluaciones sanitarias válidas,Bovinos con resultado compatible con miasis (predicción IA),Bovinos con sospecha profesional,Bovinos con diagnóstico veterinario confirmado,Bovinos en seguimiento,Casos sospechosos,Casos confirmados,Casos cerrados')
  expect(lines.filter(l => /^12\d{3},/.test(l))).toHaveLength(85)
  expect(lines).toContain('12029,Chilpancingo de los Bravo,Centro,3,17,2,5,1,0,1,1,0,1,1')
  expect(lines).toContain('12076,Acatepec,,0,0,0,0,0,0,0,0,0,0,0')
  expect(lines).toContain('TOTAL,Total Guerrero,,4,19,2,5,1,0,1,1,0,1,1')
  expect(text).toContain('no constituye un diagnóstico confirmado')
  expect(text).not.toMatch(/FIXTURE|ranch_name|latitude/)
  expect(calls.filter(c => c.path === '/api/reports/municipalities').every(c => !c.auth)).toBeTruthy()
  expect(calls.some(c => c.path === '/api/reports/ranches')).toBeFalsy()

  await page.getByLabel('Solo municipios con registros').check()
  await expect(table.locator('tbody tr')).toHaveCount(2)
  await page.getByLabel('Separador del archivo CSV').selectOption('semicolon')
  const second = await download(page)
  expect(second.text.slice(1).split('\r\n')[1]).toBe('12029;Chilpancingo de los Bravo;Centro;3;17;2;5;1;0;1;1;0;1;1')
})

test('report filters are sent to the service and municipality filter narrows the table', async ({ page }) => {
  const calls = await mock(page)
  await openReports(page)
  await page.getByLabel('Municipio (reporte)', { exact: true }).selectOption('12029')
  const table = page.getByRole('region', { name: 'Tabla del reporte municipal' })
  await expect(table.locator('tbody tr')).toHaveCount(1)
  await page.getByLabel('Región (reporte)', { exact: true }).selectOption('CENTRO')
  await page.getByLabel('Mes (reporte)', { exact: true }).selectOption('2026-11')
  await expect.poll(() => calls.filter(c => c.path === '/api/reports/municipalities').at(-1)?.query).toContain('month=2026-11')
  expect(calls.filter(c => c.path === '/api/reports/municipalities').at(-1).query).toContain('region=CENTRO')
  await page.getByRole('button', { name: 'Restablecer', exact: true }).click()
  await expect(table.locator('tbody tr')).toHaveCount(86)
})

test('private ranch report requires login, includes ranches without evaluations and neutralises formulas', async ({ page }) => {
  const calls = await mock(page)
  await openReports(page)
  await page.getByRole('tab', { name: /Reporte por rancho/ }).click()
  await expect(page.getByText('Disponible solo para propietarios y veterinarios asignados.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Descargar CSV' })).toHaveCount(0)
  expect(calls.some(c => c.path === '/api/reports/ranches')).toBeFalsy()

  await page.getByRole('button', { name: 'Iniciar sesión para consultar', exact: true }).click()
  await page.getByLabel('Correo', { exact: true }).fill('fixture@test.invalid'); await page.getByLabel('Contraseña', { exact: true }).fill('fixture-password')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await page.locator('#reportes').scrollIntoViewIfNeeded()
  await page.getByRole('tab', { name: /Reporte por rancho/ }).click()
  const table = page.getByRole('region', { name: 'Tabla del reporte por rancho' })
  await expect(table.locator('tbody tr')).toHaveCount(2)
  await expect(table.locator('tbody tr', { hasText: 'Rancho Sin Evaluaciones' })).toContainText('Sin evaluaciones')
  await expect(table.locator('tfoot [data-total="registered_animals"]')).toHaveText('17')
  expect(calls.filter(c => c.path === '/api/reports/ranches').every(c => c.auth === 'Bearer fixture-token')).toBeTruthy()
  const { name, text } = await download(page)
  expect(name).toMatch(/^bovisafe_reporte-ranchos_/)
  const lines = text.slice(1).split('\r\n')
  expect(lines[0]).toBe('Rancho,Municipio,Región declarada,Acceso,Bovinos registrados,Bovinos evaluados (únicos),Total de evaluaciones,Bovinos con resultado compatible con miasis (predicción IA),Bovinos con sospecha profesional,Bovinos con diagnóstico veterinario confirmado,Bovinos en seguimiento,Fecha de última evaluación (hora del centro de México)')
  expect(lines[1]).toBe(`"'=HYPERLINK(""http://malicioso"")",Chilpancingo de los Bravo,Centro,Propietario,12,2,5,1,0,1,1,2026-11-17 00:20`)
  expect(lines[2]).toBe('Rancho Sin Evaluaciones,Acatepec,,Veterinario asignado,5,0,0,0,0,0,0,Sin evaluaciones en el periodo')
  expect(lines[3]).toBe('Total de ranchos autorizados,,,,17,2,5,1,0,1,1,')
  expect(text).not.toMatch(/17\.55|-99\.5|latitude|longitude/)
})

test('report failures show a retry without inventing rows', async ({ page }) => {
  await mock(page, { failMunicipal: true })
  await openReports(page)
  await expect(page.getByText('Fallo controlado del reporte')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Tabla del reporte municipal' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Descargar CSV' })).toBeDisabled()
  await page.unroute('**/api/**'); await mock(page)
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Tabla del reporte municipal' }).locator('tbody tr')).toHaveCount(86)
})

test('map keeps layers and camera stable across data refreshes and selections', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  await mock(page)
  await page.goto('/')
  const map = page.locator('.operative-map'); await map.scrollIntoViewIfNeeded()
  await expect(page.locator('.livestock-pin')).toHaveCount(1)
  await expect(map).toHaveAttribute('data-state-fits', 'true')
  await page.evaluate(() => { document.querySelector('.operative-map .leaflet-overlay-pane path').dataset.probe = 'kept'; document.querySelector('.livestock-pin').dataset.probe = 'kept' })
  const before = { zoom: await map.getAttribute('data-zoom'), center: await map.getAttribute('data-center') }
  await page.getByRole('button', { name: 'Actualizar consulta', exact: true }).click()
  await expect(page.locator('.map-loading')).toHaveCount(0)
  expect(await page.locator('.operative-map .leaflet-overlay-pane path[data-probe="kept"]').count()).toBe(1)
  expect(await page.locator('.livestock-pin[data-probe="kept"]').count()).toBe(1)
  expect(await map.getAttribute('data-zoom')).toBe(before.zoom)
  expect(await map.getAttribute('data-center')).toBe(before.center)
  await page.getByLabel('Municipio', { exact: true }).selectOption('12029')
  await expect(page.getByLabel('Detalle municipal')).toContainText('Chilpancingo')
  await expect.poll(async () => Number(await map.getAttribute('data-zoom'))).toBeGreaterThan(Number(before.zoom))
  expect(await page.locator('.operative-map .leaflet-overlay-pane path[data-probe="kept"]').count()).toBe(1)
  await expect(page.locator('.leaflet-municipal-selection-pane path')).toHaveCount(1)
  await page.getByRole('button', { name: 'Cerrar detalle', exact: true }).click()
  await expect(page.getByLabel('Municipio', { exact: true })).toHaveValue('')
  await expect.poll(async () => map.getAttribute('data-state-fits')).toBe('true')
  await expect(page.locator('.leaflet-municipal-selection-pane path')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('mobile layout keeps reports and map within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mock(page)
  await openReports(page)
  await expect(page.getByRole('region', { name: 'Tabla del reporte municipal' }).locator('tbody tr')).toHaveCount(86)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  await page.screenshot({ path: 'verification/reports-mobile.png', fullPage: false })
})
