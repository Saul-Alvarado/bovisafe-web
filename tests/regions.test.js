import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { wholeMunicipalities, partialMunicipalities, officialRegion, combineRegionRows, ranchInRegion, regionIncludes } from '../src/territory/regions.js'
import { combineSnapshot } from '../src/live/useObservatoryData.js'
import { fingerprint } from '../src/live/live.js'

const catalog = JSON.parse(fs.readFileSync(new URL('../public/geo/guerrero-catalog.json', import.meta.url), 'utf8'))
const name = Object.fromEntries(catalog.municipalities.features.map(f => [f.properties.code, f.properties.name]))
const codeOf = text => Object.keys(name).find(code => name[code] === text)

test('official composition matches the published regional programs (by INEGI name)', () => {
  const sizes = Object.fromEntries(catalog.regions.map(r => [r.code, wholeMunicipalities(r.code).size]))
  assert.deepEqual(sizes, { ACAPULCO: 1, CENTRO: 11, COSTA_CHICA: 18, COSTA_GRANDE: 8, NORTE: 16, MONTANA: 19, TIERRA_CALIENTE: 9, SIERRA: 2 })
  const seen = new Set()
  for (const r of catalog.regions) for (const code of wholeMunicipalities(r.code)) { assert.ok(name[code], code); assert.ok(!seen.has(code), `duplicado ${code}`); seen.add(code) }
  assert.equal(seen.size, 84)
  assert.equal(officialRegion(codeOf('Santa Cruz del Rincón')), null)
  // 2021 municipalities: the programs use state numbering, matched here by name.
  for (const m of ['Las Vigas', 'Ñuu Savi', 'San Nicolás', 'Ometepec', 'San Marcos']) assert.equal(officialRegion(codeOf(m)), 'COSTA_CHICA', m)
  for (const m of ['General Heliodoro Castillo', 'Leonardo Bravo']) assert.equal(officialRegion(codeOf(m)), 'SIERRA', m)
  assert.equal(officialRegion(codeOf('Chilpancingo de los Bravo')), 'CENTRO')
  assert.equal(partialMunicipalities('SIERRA').size, 12)
  for (const code of partialMunicipalities('SIERRA')) assert.notEqual(officialRegion(code), 'SIERRA')
})

test('region rule: whole members, declared ranches, Sierra partial members', () => {
  assert.ok(ranchInRegion('COSTA_CHICA', '12046', null))
  assert.ok(!ranchInRegion('COSTA_CHICA', '12029', null))
  assert.ok(ranchInRegion('SIERRA', '12011', 'SIERRA'))
  assert.ok(!ranchInRegion('SIERRA', '12011', null))
  assert.ok(ranchInRegion('', '12011', null))
  assert.ok(regionIncludes('SIERRA', '12011') && regionIncludes('SIERRA', '12032') && !regionIncludes('SIERRA', '12046'))
})

test('combining general and declared answers never counts a row twice', () => {
  const row = (code, evaluations, registered_ranches = 1) => ({ code, evaluations, registered_ranches })
  const all = [row('12046', 3), row('12029', 4), row('12011', 2), row('12032', 0, 0)]
  // Each declared answer only holds ranches that declared that region (as the server returns it).
  const declaredCostaChica = [row('12046', 1), row('12029', 0, 0), row('12011', 0, 0), row('12032', 0, 0), row('12052', 2)]
  assert.deepEqual(combineRegionRows(all, declaredCostaChica, 'COSTA_CHICA').map(r => [r.code, r.evaluations, r.membership]), [['12046', 3, 'official']])
  const declaredCentro = [row('12046', 1), row('12029', 0, 0)]
  assert.deepEqual(combineRegionRows(all, declaredCentro, 'CENTRO').map(r => [r.code, r.evaluations, r.membership]), [['12029', 4, 'official'], ['12046', 1, 'declared']])
  const declaredSierra = [row('12046', 0, 0), row('12029', 0, 0), row('12011', 2), row('12032', 0, 0)]
  const sierra = combineRegionRows(all, declaredSierra, 'SIERRA')
  assert.deepEqual(sierra.map(r => [r.code, r.evaluations, r.membership]), [['12032', 0, 'official'], ['12029', 0, 'partial'], ['12011', 2, 'partial']])
  assert.equal(combineRegionRows(all, null, ''), all)
})

test('observatory snapshot for a region sums its municipalities and labels charts as state-wide', () => {
  const m = (code, evaluations, animals) => ({ code, name: code, evaluations, animals, ranches: 1, registered_animals: 2 })
  const feature = (id, municipality) => ({ type: 'Feature', id, geometry: { type: 'Point', coordinates: [0, 0] }, properties: { ranch_id: id, municipality } })
  const all = { summary: { evaluations: 9, animals: 6, ranches: 3, registered_animals: 6 }, municipalities: [m('12046', 3, 2), m('12053', 1, 1), m('12029', 5, 3)], map: { type: 'FeatureCollection', features: [feature(1, '12046'), feature(2, '12029')] }, trend: [], categories: [] }
  const declared = { summary: {}, municipalities: [m('12029', 2, 1)], map: { type: 'FeatureCollection', features: [feature(2, '12029'), feature(3, '12029')] } }
  const view = combineSnapshot(all, declared, 'COSTA_CHICA', '')
  assert.equal(view.summary.evaluations, 6)
  assert.equal(view.summary.animals, 4)
  assert.deepEqual(view.municipalities.map(r => r.code), ['12046', '12053', '12029'])
  assert.deepEqual(view.map.features.map(f => f.id), [1, 2, 3])
  assert.equal(view.chartsScope, 'state')
  assert.equal(combineSnapshot(all, null, '', ''), all)
})

test('fingerprint ignores generatedAt so unchanged data does not re-render or notify', () => {
  assert.equal(fingerprint({ a: 1, generatedAt: '2026-11-24T10:00:00Z' }), fingerprint({ a: 1, generatedAt: '2026-11-24T10:01:00Z' }))
  assert.notEqual(fingerprint({ a: 1 }), fingerprint({ a: 2 }))
})
