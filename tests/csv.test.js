import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toCsv, escapeCell, neutralize, safeFileName } from '../src/reports/csv.js'
import { municipalColumns, ranchColumns, mexicoDate, sumRows, MUNICIPAL_METRICS } from '../src/reports/definitions.js'

test('formula injection is neutralised for every dangerous prefix', () => {
  for (const value of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tTAB', '\rCR', '＝HYPERLINK("x")']) assert.equal(neutralize(value)[0], "'", value)
  assert.equal(neutralize('Rancho El Llano'), 'Rancho El Llano')
  assert.equal(neutralize(-5), '-5', 'numbers are kept numeric')
  assert.equal(neutralize(0), '0')
  assert.equal(neutralize(null), '')
})

test('quoting follows RFC 4180 for the selected separator', () => {
  assert.equal(escapeCell('a,b', ','), '"a,b"')
  assert.equal(escapeCell('a,b', ';'), 'a,b')
  assert.equal(escapeCell('a;b', ';'), '"a;b"')
  assert.equal(escapeCell('dijo "hola"'), '"dijo ""hola"""')
  assert.equal(escapeCell('línea\nnueva'), '"línea\nnueva"')
  assert.equal(escapeCell('=cmd|"/c calc"!A1'), `"'=cmd|""/c calc""!A1"`)
})

test('CSV is UTF-8 with BOM, CRLF, headers, totals and notes', () => {
  const columns = municipalColumns([{ code: 'CENTRO', name: 'Centro' }])
  const rows = [
    { code: '12029', name: 'Chilpancingo de los Bravo', regions: ['CENTRO'], registered_ranches: 2, registered_animals: 10, animals: 3, evaluations: 5, nws_animals: 1 },
    { code: '12076', name: 'Acatepec', regions: [], registered_ranches: 0 },
  ]
  const csv = toCsv(columns, rows, { footer: [['TOTAL', 'Total Guerrero', '', 2, 10, 3, 5, 1, 0, 0, 0, 0, 0, 0]], notes: [['Periodo', '2026-11-01 a 2026-11-24']] })
  assert.ok(csv.startsWith('﻿Clave INEGI,Municipio,Región declarada,Ranchos registrados,Bovinos registrados,Bovinos evaluados (únicos),Evaluaciones sanitarias válidas'))
  const lines = csv.slice(1).split('\r\n')
  assert.equal(lines[1], '12029,Chilpancingo de los Bravo,Centro,2,10,3,5,1,0,0,0,0,0,0')
  assert.equal(lines[2], '12076,Acatepec,,0,0,0,0,0,0,0,0,0,0,0', 'municipalities without records are zero-filled')
  assert.equal(lines[3].split(',')[1], 'Total Guerrero')
  assert.equal(lines[4], '')
  assert.ok(csv.endsWith('\r\n'))
  assert.equal(columns.length, 3 + MUNICIPAL_METRICS.length)
})

test('ranch report keeps ranches without evaluations and never confuses animals with evaluations', () => {
  const columns = ranchColumns([])
  const csv = toCsv(columns, [
    { ranch_name: '=HYPERLINK("http://x")', municipality_name: 'Acatepec', access: 'OWNER', registered_animals: 4, animals: 0, evaluations: 0, last_evaluation_at: null },
    { ranch_name: 'La Loma', municipality_name: 'Chilpancingo de los Bravo', access: 'VETERINARIAN', registered_animals: 3, animals: 1, evaluations: 2, nws_animals: 1, last_evaluation_at: '2026-11-17T06:20:00Z' },
  ], { separator: ';' })
  const lines = csv.slice(1).split('\r\n')
  assert.ok(lines[0].includes('Bovinos evaluados (únicos);Total de evaluaciones'))
  assert.equal(lines[1], `"'=HYPERLINK(""http://x"")";Acatepec;;Propietario;4;0;0;0;0;0;0;Sin evaluaciones en el periodo`)
  assert.equal(lines[2], 'La Loma;Chilpancingo de los Bravo;;Veterinario asignado;3;1;2;1;0;0;0;2026-11-17 00:20')
})

test('dates are rendered in Mexico City time and file names are safe', () => {
  assert.equal(mexicoDate('2026-11-17T06:20:00Z'), '2026-11-17 00:20')
  assert.equal(mexicoDate('2026-11-17T06:20:00'), '2026-11-17 00:20')
  assert.equal(mexicoDate(null), '')
  assert.equal(safeFileName('bovisafe', 'reporte municipal', '2026-11-01', 'Montaña'), 'bovisafe_reporte-municipal_2026-11-01_montana.csv')
  assert.deepEqual(sumRows([{ a: 1, b: '2' }, { a: 3 }], ['a', 'b']), { a: 4, b: 2 })
})
