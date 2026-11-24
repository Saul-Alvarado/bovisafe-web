import { test, expect } from '@playwright/test'
import fs from 'node:fs'

// Isolated fixtures only: an in-memory API whose records change while the page stays open.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXZkAAAAASUVORK5CYII=', 'base64')
const catalog = JSON.parse(fs.readFileSync('public/geo/guerrero-catalog.json', 'utf8'))
const NAMES = Object.fromEntries(catalog.municipalities.features.map(f => [f.properties.code, f.properties.name]))
const COSTA_CHICA = ['12012', '12013', '12018', '12023', '12025', '12030', '12036', '12046', '12052', '12053', '12056', '12062', '12071', '12077', '12080', '12082', '12083', '12085']
const KEYS = ['registered_ranches', 'registered_animals', 'evaluated_ranches', 'animals', 'evaluations', 'nws_predictions', 'nws_animals', 'suspected_animals', 'confirmed_animals', 'follow_up_animals', 'suspected_cases', 'confirmed_cases', 'follow_up_cases', 'closed_cases']
const record = (o = {}) => ({ registered_ranches: 1, registered_animals: 0, evaluated_ranches: 0, animals: 0, evaluations: 0, nws_predictions: 0, nws_animals: 0, suspected_animals: 0, confirmed_animals: 0, follow_up_animals: 0, suspected_cases: 0, confirmed_cases: 0, follow_up_cases: 0, closed_cases: 0, declared: null, ...o })
const sum = rows => Object.fromEntries(KEYS.map(k => [k, rows.reduce((t, r) => t + (r[k] || 0), 0)]))

function server(records) {
  const s = { records, fail: false, calls: [] }
  const visible = (region, r) => !region || r.declared === region
  s.observatory = url => {
    const region = url.searchParams.get('region'), municipality = url.searchParams.get('municipality')
    const rows = Object.entries(s.records).filter(([code, r]) => r.evaluations > 0 && visible(region, r) && (!municipality || code === municipality))
      .map(([code, r]) => ({ code, name: NAMES[code], ranches: r.evaluated_ranches, ...Object.fromEntries(KEYS.map(k => [k, r[k]])) }))
    const summary = { ...sum(rows), ranches: rows.reduce((t, r) => t + r.ranches, 0) }
    const nws = summary.nws_predictions
    const out = { publicMarkerMinimumRanches: 1, summary, trend: [{ month: '2026-11', ...summary }], categories: [{ category: 'NWS', count: nws }, { category: 'HEALTHY', count: summary.evaluations - nws }, { category: 'LESION', count: 0 }], caseStates: [], municipalities: rows, regions: [], map: { type: 'FeatureCollection', features: [] }, unlocatedRanches: 0, scope: 'PUBLIC_AGGREGATED', from: '2026-11-01', to: '2026-11-24', availableMonths: ['2026-11'], operationalStart: '2026-11-01', generatedAt: new Date().toISOString() }
    if (municipality) { const all = new URL(url); all.searchParams.delete('municipality'); out.territorial = s.observatory(all) }
    return out
  }
  s.report = url => {
    const region = url.searchParams.get('region'), municipality = url.searchParams.get('municipality')
    const rows = catalog.municipalities.features.map(f => f.properties.code).filter(code => !municipality || code === municipality).map(code => {
      const r = s.records[code], data = r && visible(region, r) ? r : null
      return { code, name: NAMES[code], regions: r?.declared ? [r.declared] : [], ...Object.fromEntries(KEYS.map(k => [k, data ? data[k] : 0])) }
    }).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    return { scope: 'PUBLIC_AGGREGATED', from: '2026-11-01', to: '2026-11-24', generatedAt: new Date().toISOString(), rows, unlocated: null, totals: sum(rows), criteria: 'Registros OPERATIONAL; TEST excluidos.' }
  }
  return s
}

async function open(page, s, { interval = 700 } = {}) {
  await page.addInitScript(ms => { window.__BOVISAFE_TEST__ = true; window.__BOVISAFE_REFRESH_MS__ = ms }, interval)
  await page.route('https://tile.openstreetmap.org/**', r => r.fulfill({ contentType: 'image/png', body: png }))
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()), path = url.pathname
    s.calls.push({ path, query: url.search, at: Date.now() })
    if (s.fail) return route.fulfill({ status: 503, json: { message: 'Servicio temporalmente no disponible' } })
    if (path === '/api/observatory') return route.fulfill({ json: s.observatory(url) })
    if (path === '/api/reports/municipalities') return route.fulfill({ json: s.report(url) })
    return route.fulfill({ status: 404, json: { message: 'Fixture no configurado' } })
  })
  await page.goto('/')
  await expect(page.locator('[data-metric="evaluations"]')).not.toHaveText('—')
}
const pin = (page, name) => page.locator(`.livestock-pin[title="Agregado municipal: ${name}"]`)
const setVisibility = (page, state) => page.evaluate(value => { Object.defineProperty(document, 'visibilityState', { value, configurable: true }); Object.defineProperty(document, 'hidden', { value: value === 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) }, state)

test('new evaluations update counts and markers in place, without reload, duplicates or losing zoom and selection', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  const s = server({
    12029: record({ registered_animals: 5, evaluated_ranches: 1, animals: 1, evaluations: 2, nws_predictions: 2, nws_animals: 1, follow_up_animals: 1, follow_up_cases: 1 }),
    12066: record({ registered_ranches: 2, registered_animals: 7 }),
  })
  await open(page, s)
  await page.evaluate(() => { window.__sameDocument = 'yes' })
  await expect(page.locator('[data-metric="evaluations"]')).toHaveText('2')
  const map = page.locator('.operative-map'); await map.scrollIntoViewIfNeeded()
  await expect(map).toHaveAttribute('data-state-fits', 'true')
  // Registered inventory without evaluations is drawn apart from surveillance markers, at the municipal reference point.
  await expect(page.locator('.livestock-pin.tone-inventory')).toHaveCount(1)
  await expect(page.locator('.livestock-pin.tone-inventory')).toHaveAttribute('title', 'Inventario municipal: Tlapa de Comonfort')
  await expect(page.locator('.livestock-pin:not(.tone-inventory)')).toHaveCount(1)
  await expect(pin(page, 'Chilpancingo de los Bravo')).toHaveClass(/tone-visual/)
  await page.evaluate(() => { document.querySelector('.livestock-pin[title="Agregado municipal: Chilpancingo de los Bravo"]').dataset.probe = 'kept'; document.querySelector('.operative-map .leaflet-overlay-pane path').dataset.probe = 'kept' })
  await pin(page, 'Chilpancingo de los Bravo').click()
  const detail = page.getByLabel('Detalle municipal')
  await expect(detail).toContainText('Chilpancingo de los Bravo')
  await expect(detail.locator('.sr-only')).toHaveText('2 evaluaciones sanitarias válidas')
  const camera = { zoom: await map.getAttribute('data-zoom'), center: await map.getAttribute('data-center') }

  // 1) Android syncs one more photo in Chilpancingo: the same marker element updates in place.
  s.records[12029] = { ...s.records[12029], registered_animals: 6, evaluations: 3 }
  await expect(page.locator('[data-metric="evaluations"]')).toHaveText('3')
  await expect(page.locator('.obs-toast')).toContainText('Se encontraron nuevos registros. Información actualizada.')
  await expect(page.locator('.livestock-pin[data-probe="kept"] .livestock-count')).toHaveText('6')
  await expect(page.locator('.livestock-pin[data-probe="kept"]')).toHaveClass(/pin-selected/)
  await expect(detail.locator('.sr-only')).toHaveText('3 evaluaciones sanitarias válidas')

  // 2) A first valid HEALTHY evaluation in Iguala and Tlapa's first evaluation: markers are added, never emptied.
  await page.evaluate(() => { window.__minPins = Infinity; const sample = () => { window.__minPins = Math.min(window.__minPins, document.querySelectorAll('.livestock-pin').length); window.__sampler = requestAnimationFrame(sample) }; sample() })
  s.records[12035] = record({ registered_animals: 4, evaluated_ranches: 1, animals: 1, evaluations: 1 })
  s.records[12066] = { ...s.records[12066], evaluated_ranches: 1, animals: 1, evaluations: 1, nws_predictions: 1, nws_animals: 1 }
  await expect(page.locator('[data-metric="evaluations"]')).toHaveText('5')
  await expect(page.locator('.livestock-pin:not(.tone-inventory)')).toHaveCount(3)
  await expect(page.locator('.livestock-pin.tone-inventory')).toHaveCount(0)
  expect(await page.evaluate(() => { cancelAnimationFrame(window.__sampler); return window.__minPins })).toBeGreaterThanOrEqual(2)
  await expect(pin(page, 'Iguala de la Independencia')).toHaveClass(/tone-registered/)
  await expect(pin(page, 'Tlapa de Comonfort')).toHaveClass(/tone-visual/)
  await expect(pin(page, 'Chilpancingo de los Bravo')).toHaveCount(1)
  await expect(pin(page, 'Chilpancingo de los Bravo')).toHaveClass(/pin-selected/)
  await expect(detail).toContainText('Chilpancingo de los Bravo')
  expect(await page.locator('.operative-map .leaflet-overlay-pane path[data-probe="kept"]').count()).toBe(1)
  expect(await map.getAttribute('data-zoom')).toBe(camera.zoom)
  expect(await map.getAttribute('data-center')).toBe(camera.center)
  expect(await page.evaluate(() => window.__sameDocument)).toBe('yes')
  await expect(page.locator('.map-loading')).toHaveCount(0)

  // Unchanged data (only generatedAt differs) keeps polling but never repeats the notice.
  await page.getByRole('button', { name: 'Cerrar aviso' }).click()
  const before = s.calls.filter(c => c.path === '/api/observatory').length
  await page.waitForTimeout(2600)
  expect(s.calls.filter(c => c.path === '/api/observatory').length).toBeGreaterThan(before)
  await expect(page.locator('.obs-toast')).toHaveCount(0)
  await expect(page.locator('.obs-live')).toContainText('Actualización automática activa · Última consulta:')
  // Requests never include a frozen end date, so records after midnight still enter the period.
  expect(s.calls.every(c => !/[?&]to=/.test(c.query))).toBeTruthy()
  expect(errors).toEqual([])
})

test('hidden tab makes no requests and refreshes as soon as it is visible again', async ({ page }) => {
  const s = server({ 12029: record({ evaluated_ranches: 1, animals: 1, evaluations: 1 }) })
  await open(page, s)
  await page.waitForTimeout(900)
  await setVisibility(page, 'hidden')
  await expect(page.locator('.obs-live')).toContainText('en pausa')
  await page.waitForTimeout(300)
  const hiddenAt = s.calls.length
  await page.waitForTimeout(2500)
  expect(s.calls.length).toBe(hiddenAt)
  s.records[12029] = { ...s.records[12029], evaluations: 4 }
  await setVisibility(page, 'visible')
  await expect(page.locator('[data-metric="evaluations"]')).toHaveText('4')
  expect(s.calls.length).toBeGreaterThan(hiddenAt)
})

test('a failed background refresh keeps the data and recovers automatically', async ({ page }) => {
  const s = server({ 12029: record({ evaluated_ranches: 1, animals: 1, evaluations: 2 }) })
  await open(page, s)
  s.fail = true
  await expect(page.locator('.obs-live')).toHaveAttribute('data-live', 'stale')
  await expect(page.locator('[data-metric="evaluations"]')).toHaveText('2')
  await expect(page.locator('.livestock-pin')).toHaveCount(1)
  await expect(page.locator('.obs-error')).toHaveCount(0)
  s.fail = false; s.records[12029] = { ...s.records[12029], evaluations: 3 }
  await expect(page.locator('[data-metric="evaluations"]')).toHaveText('3', { timeout: 15000 })
  await expect(page.locator('.obs-live')).toHaveAttribute('data-live', 'active')
})

const regional = () => server({
  12046: record({ registered_animals: 8, evaluated_ranches: 1, animals: 2, evaluations: 3, nws_predictions: 1, nws_animals: 1 }), // Ometepec · Costa Chica
  12053: record({ registered_ranches: 2, registered_animals: 5, evaluated_ranches: 1, animals: 1, evaluations: 1 }), // San Marcos · Costa Chica
  12029: record({ registered_animals: 9, evaluated_ranches: 1, animals: 3, evaluations: 4 }), // Chilpancingo · Centro
  12011: record({ registered_animals: 6, evaluated_ranches: 1, animals: 2, evaluations: 2, declared: 'SIERRA' }), // Atoyac · Costa Grande, ranch declared Sierra
})
async function openReports(page) {
  await page.locator('#reportes').scrollIntoViewIfNeeded()
  const table = page.getByRole('region', { name: 'Tabla del reporte municipal' })
  await expect(table.locator('tbody tr')).toHaveCount(85)
  return table
}
async function download(page) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Descargar CSV', exact: true }).click()])
  return { name: file.suggestedFilename(), text: fs.readFileSync(await file.path(), 'utf8') }
}

test('region filter narrows rows, totals, municipality options and CSV to the official region', async ({ page }) => {
  const s = regional()
  await open(page, s)
  const table = await openReports(page)
  await page.getByLabel('Región (reporte)', { exact: true }).selectOption('COSTA_CHICA')
  await expect(table.locator('tbody tr')).toHaveCount(18)
  const codes = await table.locator('tbody tr').evaluateAll(rows => rows.map(r => r.dataset.code))
  expect(codes.sort()).toEqual([...COSTA_CHICA].sort())
  await expect(table.locator('tbody tr', { hasText: 'Chilpancingo' })).toHaveCount(0)
  await expect(table.locator('tbody tr', { hasText: 'Acapulco' })).toHaveCount(0)
  await expect(table.locator('tfoot [data-total-label]')).toHaveText('Total Costa Chica')
  await expect(table.locator('tfoot [data-total="evaluations"]')).toHaveText('4')
  await expect(table.locator('tfoot [data-total="registered_animals"]')).toHaveText('13')
  await expect(page.locator('[data-scope]')).toHaveText('Región Costa Chica')
  await expect(page.getByRole('button', { name: 'Quitar filtro Región Costa Chica' })).toBeVisible()
  await expect(page.locator('#rep-municipality option')).toHaveCount(19)
  const { name, text } = await download(page)
  expect(name).toBe('bovisafe_reporte-municipal_2026-11-01_2026-11-24_costa_chica.csv')
  const lines = text.slice(1).split('\r\n')
  const data = lines.filter(l => /^12\d{3},/.test(l))
  expect(data).toHaveLength(18)
  expect(data.every(l => COSTA_CHICA.includes(l.slice(0, 5)))).toBeTruthy()
  expect(lines[0]).toContain('Región (catálogo oficial),Región declarada por ranchos,Pertenencia a la región filtrada')
  expect(lines).toContain('12046,Ometepec,Costa Chica,,Municipio de la región,1,8,2,3,1,0,0,0,0,0,0')
  expect(lines).toContain('TOTAL,Total Costa Chica,,,,3,13,3,4,1,0,0,0,0,0,0')
  expect(text).toContain('Ámbito,Región: Costa Chica')
  expect(text).toContain('Programas Regionales 2022-2027')

  // Municipality inside the region, then back to all regions.
  await page.getByLabel('Municipio (reporte)', { exact: true }).selectOption('12046')
  await expect(table.locator('tbody tr')).toHaveCount(1)
  await expect(table.locator('tfoot [data-total-label]')).toHaveText('Total Ometepec')
  await page.getByLabel('Región (reporte)', { exact: true }).selectOption('')
  await expect(table.locator('tbody tr')).toHaveCount(85)
  await expect(table.locator('tfoot [data-total-label]')).toHaveText('Total Guerrero')
  await expect(table.locator('tfoot [data-total="evaluations"]')).toHaveText('10')
  const all = await download(page)
  expect(all.text.slice(1).split('\r\n').filter(l => /^12\d{3},/.test(l))).toHaveLength(85)
  expect(all.text).toContain('TOTAL,Total Guerrero,,,5,28,8,10,1,0,0,0,0,0,0')
})

test('Sierra lists its two whole municipalities and partial ones count only ranches that declared Sierra', async ({ page }) => {
  const s = regional()
  await open(page, s)
  const table = await openReports(page)
  await page.getByLabel('Región (reporte)', { exact: true }).selectOption('SIERRA')
  await expect(table.locator('tbody tr')).toHaveCount(14)
  await expect(table.locator('tbody tr[data-code="12032"]')).toContainText('General Heliodoro Castillo')
  await expect(table.locator('tbody tr[data-code="12011"]')).toContainText('Parcial: solo ranchos que declararon la región')
  // Chilpancingo is a partial member but its ranch did not declare Sierra: listed with zeros.
  await expect(table.locator('tbody tr[data-code="12029"] td.num').nth(3)).toHaveText('0')
  await expect(table.locator('tfoot [data-total="evaluations"]')).toHaveText('2')
  // Costa Grande counts all of Atoyac, whatever the declared region.
  await page.getByLabel('Región (reporte)', { exact: true }).selectOption('COSTA_GRANDE')
  await expect(table.locator('tbody tr')).toHaveCount(8)
  await expect(table.locator('tfoot [data-total="evaluations"]')).toHaveText('2')
})

test('observatory region applies the same territory and "Usar filtros del observatorio" carries it to the report', async ({ page }) => {
  const s = regional()
  await open(page, s)
  await page.getByLabel('Región', { exact: true }).selectOption('COSTA_CHICA')
  await expect(page.locator('[data-metric="evaluations"]')).toHaveText('4')
  await expect(page.locator('.obs-region-note')).toContainText('18 municipios del catálogo oficial')
  await expect(page.locator('.chart-scope').first()).toContainText('Todo Guerrero')
  await expect(page.locator('#obs-municipality option')).toHaveCount(19)
  await expect(page.locator('.livestock-pin')).toHaveCount(2)
  await expect(pin(page, 'Chilpancingo de los Bravo')).toHaveCount(0)
  const table = await page.locator('#reportes').scrollIntoViewIfNeeded().then(() => page.getByRole('region', { name: 'Tabla del reporte municipal' }))
  await expect(table.locator('tbody tr')).toHaveCount(85)
  await page.getByRole('button', { name: 'Usar filtros del observatorio', exact: true }).click()
  await expect(page.getByLabel('Región (reporte)', { exact: true })).toHaveValue('COSTA_CHICA')
  await expect(table.locator('tbody tr')).toHaveCount(18)
  await expect(table.locator('tfoot [data-total="evaluations"]')).toHaveText('4')
  // A municipality of the region keeps the region and narrows the indicators to it.
  await page.getByLabel('Municipio', { exact: true }).selectOption('12046')
  await expect(page.getByLabel('Región', { exact: true })).toHaveValue('COSTA_CHICA')
  await expect(page.locator('[data-metric="evaluations"]')).toHaveText('3')
})

test('report tables refresh automatically while keeping sorting and filters', async ({ page }) => {
  const s = regional()
  await open(page, s)
  const table = await openReports(page)
  await page.getByLabel('Región (reporte)', { exact: true }).selectOption('COSTA_CHICA')
  await expect(table.locator('tbody tr')).toHaveCount(18)
  await table.getByRole('button', { name: 'Evaluaciones', exact: true }).click()
  await expect(table.locator('tbody tr').first()).toHaveAttribute('data-code', '12046')
  s.records[12053] = { ...s.records[12053], evaluations: 9, animals: 3 }
  await expect(table.locator('tfoot [data-total="evaluations"]')).toHaveText('12')
  await expect(table.locator('tbody tr').first()).toHaveAttribute('data-code', '12053')
  await expect(page.getByLabel('Región (reporte)', { exact: true })).toHaveValue('COSTA_CHICA')
  await expect(table.locator('th[aria-sort="descending"]')).toHaveCount(1)
  await expect(table.locator('tbody tr')).toHaveCount(18)
})

test('public view never asks for private data and inventory markers carry no ranch identity', async ({ page }) => {
  const s = server({ 12066: record({ registered_ranches: 2, registered_animals: 7 }) })
  await open(page, s)
  await page.waitForTimeout(1600)
  expect(s.calls.some(c => c.path.includes('/authorized') || c.path === '/api/reports/ranches')).toBeFalsy()
  await page.locator('.operative-map').scrollIntoViewIfNeeded()
  await page.locator('.livestock-pin.tone-inventory').click()
  const panel = page.getByLabel('Inventario sin evaluaciones')
  await expect(panel).toContainText('Tlapa de Comonfort')
  await expect(panel).toContainText('no indica la ubicación de ningún rancho')
  await expect(panel).toContainText('7bovinos registrados')
})

// Regression: production data (Acapulco and San Marcos clustered, Ometepec isolated) lost the isolated
// municipality because markercluster skipped its top level when the fitted minimum zoom was fractional.
for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  test(`every municipality with evaluations is represented on the map (${viewport.width}×${viewport.height})`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const s = server({
      12001: record({ registered_animals: 2, evaluated_ranches: 1, animals: 1, evaluations: 2, nws_predictions: 2, nws_animals: 1 }),
      12053: record({ registered_ranches: 2, registered_animals: 2, evaluated_ranches: 2, animals: 2, evaluations: 2, nws_predictions: 2, nws_animals: 2 }),
      12046: record({ registered_animals: 1, evaluated_ranches: 1, animals: 1, evaluations: 1, nws_predictions: 1, nws_animals: 1 }),
      12038: record({ registered_animals: 3, evaluated_ranches: 1, animals: 1, evaluations: 1 }),
    })
    await open(page, s, { interval: 60000 })
    const map = page.locator('.operative-map'); await map.scrollIntoViewIfNeeded()
    await expect(map).toHaveAttribute('data-state-fits', 'true')
    const represented = () => page.evaluate(() => {
      const pins = [...document.querySelectorAll('.leaflet-marker-pane .livestock-pin:not(.tone-inventory)')].length
      const clusters = [...document.querySelectorAll('.leaflet-marker-pane .bovine-cluster:not(.tone-inventory) [title]')].map(el => Number(el.getAttribute('title').split(' ')[0]))
      return { pins, clustered: clusters.reduce((a, b) => a + b, 0) }
    })
    await expect.poll(async () => { const r = await represented(); return r.pins + r.clustered }).toBe(4)
  })
}
