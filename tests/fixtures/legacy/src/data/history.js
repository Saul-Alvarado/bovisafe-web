/**
 * Historial completamente sintético para explorar el diseño sin API.
 * La maqueta supone una observación mensual por bovino entre junio y noviembre de 2026.
 * El backend real deberá usar fechas de evaluaciones existentes y no rellenar meses faltantes.
 */
export const MONTHS = [
  { id:'2026-06', label:'Junio 2026', short:'Jun' },
  { id:'2026-07', label:'Julio 2026', short:'Jul' },
  { id:'2026-08', label:'Agosto 2026', short:'Ago' },
  { id:'2026-09', label:'Septiembre 2026', short:'Sep' },
  { id:'2026-10', label:'Octubre 2026', short:'Oct' },
  { id:'2026-11', label:'Noviembre 2026', short:'Nov' }
]

const RISK_LEVEL = { bajo:0, moderado:1, alto:2, critico:3 }
function simulatedRisk(animal, ranch, monthIndex) {
  if (monthIndex === MONTHS.length-1) return animal.riesgo
  // Generador fijo y reproducible: nunca se usan datos clínicos reales.
  const seed = [...`${ranch.id}-${animal.id}`].reduce((a,c)=>(a*31+c.charCodeAt(0))%9973,17)
  const wave = (seed*7 + (monthIndex+1)*43 + ((seed % 7)*(monthIndex+3))) % 29
  return wave < 17 ? 'bajo' : wave < 23 ? 'moderado' : wave < 27 ? 'alto' : 'critico'
}

function withAnimals(ranch, animales, fecha) {
  return {
    ...ranch,
    fecha,
    animales,
    bovinos: animales.length,
    alertas: animales.filter(a=>RISK_LEVEL[a.riesgo]>=2).length,
    criticos: animales.filter(a=>a.riesgo==='critico').length
  }
}

/**
 * current = última evaluación; month = evaluación del mes indicado;
 * range = peor riesgo registrado por bovino EN ese rango (no suma repetida de casos).
 */
export function snapshotRanches(ranches, {mode='current',month='2026-10',from='2026-10',to='2026-11'}={}) {
  if (mode === 'current') return ranches
  const monthIds = mode === 'month'
    ? [month]
    : MONTHS.filter(m=>m.id>=from && m.id<=to).map(m=>m.id)
  return ranches.map(ranch=>{
    const animales = ranch.animales.map(animal=>{
      const risks=monthIds.map(id=>simulatedRisk(animal,ranch,MONTHS.findIndex(m=>m.id===id)))
      const riesgo=risks.reduce((worst,current)=>RISK_LEVEL[current]>RISK_LEVEL[worst]?current:worst,'bajo')
      return {...animal,riesgo,evaluacion:monthIds.join(' / ')}
    })
    const fecha=mode==='month'
      ? MONTHS.find(m=>m.id===month)?.label
      : `${MONTHS.find(m=>m.id===from)?.short}–${MONTHS.find(m=>m.id===to)?.short} 2026`
    return withAnimals(ranch,animales,fecha)
  })
}

export function monthlyTrend(ranches, zone='all') {
  const scoped=zone==='all'?ranches:ranches.filter(r=>r.zona===zone)
  return MONTHS.map((m,i)=>{
    const alertas=scoped.reduce((total,ranch)=>total+ranch.animales.filter(a=>RISK_LEVEL[simulatedRisk(a,ranch,i)]>=2).length,0)
    return {...m,alertas,bovinos:scoped.reduce((n,r)=>n+r.animales.length,0)}
  })
}

export function periodLabel({mode,month,from,to}) {
  if (mode==='current') return 'Última evaluación disponible · nov. 2026'
  if (mode==='month') return MONTHS.find(m=>m.id===month)?.label ?? month
  return `${MONTHS.find(m=>m.id===from)?.label} — ${MONTHS.find(m=>m.id===to)?.label}`
}
