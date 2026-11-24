// CSV export compatible with Excel in Spanish: UTF-8 with BOM, CRLF line endings,
// RFC 4180 quoting and protection against CSV formula injection.

export const SEPARATORS = { comma: ',', semicolon: ';' }

// Cells starting with these characters can be interpreted as formulas by spreadsheet software.
const FORMULA_START = /^[=+\-@\t\r＝＋－＠]/

/** Neutralises a text value so spreadsheets display it literally. Numbers stay numeric. */
export function neutralize(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  if (typeof value === 'bigint') return value.toString()
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  const text = String(value)
  return FORMULA_START.test(text) ? `'${text}` : text
}

export function escapeCell(value, separator = ',') {
  const text = neutralize(value)
  return /["\r\n]/.test(text) || text.includes(separator) || /^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * @param {{key:string,label:string,value?:(row:any)=>any}[]} columns
 * @param {any[]} rows
 * @param {{separator?:string, footer?:any[][], notes?:string[][]}} options
 */
export function toCsv(columns, rows, { separator = ',', footer = [], notes = [] } = {}) {
  const line = cells => cells.map(cell => escapeCell(cell, separator)).join(separator)
  const out = [line(columns.map(c => c.label))]
  for (const row of rows) out.push(line(columns.map(c => (c.value ? c.value(row) : row[c.key]))))
  for (const row of footer) out.push(line(row))
  if (notes.length) { out.push(''); for (const note of notes) out.push(line(note)) }
  return '﻿' + out.join('\r\n') + '\r\n'
}

export function safeFileName(...parts) {
  return parts.filter(Boolean).join('_').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_.-]+/g, '-').replace(/-+/g, '-').toLowerCase() + '.csv'
}

export function downloadCsv(content, fileName) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
