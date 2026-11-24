// Official municipal composition of Guerrero's eight planning regions.
//
// Source: Gobierno del Estado de Guerrero, SEPLADER, "Programas Regionales 2022-2027"
// (https://seed.guerrero.gob.mx/wp-content/uploads/2024/01/), one document per region,
// read from the published tables "Municipios que pertenecen a la región …":
//   Acapulco p. 494 ("integrada por el municipio de Acapulco de Juárez"), Centro Tabla 1 (p. 28),
//   Costa Chica Tabla 26, Costa Grande Tabla 1, Norte (p. 3851 text + Tabla 44),
//   Montaña Tabla 23, Tierra Caliente Tabla 1, Sierra (Decreto 240, 4-nov-2022).
//
// Codes are INEGI (Marco Geoestadístico). The regional programs use state numbering for the
// 2021 municipalities, which differs from INEGI, so membership was matched by NAME.
//
// Sierra is delimited by LOCALITIES, not whole municipalities. The Centro program states that
// General Heliodoro Castillo and Leonardo Bravo now belong to Sierra; the Sierra program lists
// localities of twelve other municipalities that otherwise remain in their original region.
// Those twelve are PARTIAL members: only ranches that declared the Sierra region count there.
// Santa Cruz del Rincón (created 2021) is not listed in any published regional table, so it has
// no official region here; it is never assigned by assumption.

const WHOLE = {
  ACAPULCO: ['12001'],
  CENTRO: ['12002', '12028', '12029', '12039', '12042', '12044', '12051', '12061', '12074', '12075', '12079'],
  COSTA_CHICA: ['12012', '12013', '12018', '12023', '12025', '12030', '12036', '12046', '12052', '12053', '12056', '12062', '12071', '12077', '12080', '12082', '12083', '12085'],
  COSTA_GRANDE: ['12011', '12014', '12016', '12021', '12038', '12048', '12057', '12068'],
  NORTE: ['12006', '12008', '12015', '12017', '12019', '12026', '12031', '12034', '12035', '12037', '12047', '12049', '12055', '12058', '12059', '12060'],
  MONTANA: ['12004', '12005', '12009', '12010', '12020', '12024', '12033', '12041', '12043', '12045', '12063', '12065', '12066', '12069', '12070', '12072', '12076', '12078', '12081'],
  TIERRA_CALIENTE: ['12003', '12007', '12022', '12027', '12050', '12054', '12064', '12067', '12073'],
  SIERRA: ['12032', '12040'],
}
const PARTIAL = {
  SIERRA: ['12003', '12011', '12016', '12021', '12022', '12029', '12038', '12048', '12054', '12057', '12073', '12075'],
}

export const REGION_SOURCE = 'Programas Regionales 2022-2027 del Gobierno del Estado de Guerrero (SEPLADER); Sierra según el Decreto 240 de 2022.'
export const UNASSIGNED_NOTE = 'Santa Cruz del Rincón no aparece en las tablas regionales publicadas y no se asigna a ninguna región.'

const wholeSets = Object.fromEntries(Object.entries(WHOLE).map(([k, v]) => [k, new Set(v)]))
const partialSets = Object.fromEntries(Object.entries(PARTIAL).map(([k, v]) => [k, new Set(v)]))
const EMPTY = new Set()

export const wholeMunicipalities = region => wholeSets[region] || EMPTY
export const partialMunicipalities = region => partialSets[region] || EMPTY
/** Official region whose whole territory contains the municipality (never Sierra-partial). */
export function officialRegion(code) {
  for (const [region, set] of Object.entries(wholeSets)) if (set.has(code)) return region
  return null
}
/** Municipalities a user may pick while a region is active (whole + partial members). */
export function regionIncludes(region, code) {
  return !region || wholeMunicipalities(region).has(code) || partialMunicipalities(region).has(code)
}
/** A ranch counts in a region when its municipality wholly belongs to it or the owner declared it. */
export function ranchInRegion(region, municipalityCode, declaredRegion) {
  return !region || wholeMunicipalities(region).has(municipalityCode) || declaredRegion === region
}

const hasData = row => Number(row?.registered_ranches) > 0 || Number(row?.evaluations) > 0

/**
 * Combines a region-free result (allRows) with the server's declared-region result (declaredRows).
 * Whole members take their complete municipal data; other municipalities only contribute ranches
 * that declared the region (Sierra partial members are listed even when zero). No row is counted twice.
 */
export function combineRegionRows(allRows, declaredRows, region) {
  if (!region) return allRows || []
  const whole = wholeMunicipalities(region), partial = partialMunicipalities(region)
  const out = []
  for (const row of allRows || []) if (whole.has(row.code)) out.push({ ...row, membership: 'official' })
  for (const row of declaredRows || []) {
    if (whole.has(row.code)) continue
    if (partial.has(row.code)) out.push({ ...row, membership: 'partial' })
    else if (hasData(row)) out.push({ ...row, membership: 'declared' })
  }
  return out
}

export const MEMBERSHIP_LABEL = {
  official: 'Municipio de la región',
  partial: 'Parcial: solo ranchos que declararon la región',
  declared: 'Fuera de la región oficial: ranchos que declararon la región',
}
