/** Datos 100% ficticios, solo para demostrar la interfaz; no hay API conectada. */
export const RISKS = {
  bajo: { label: 'Bajo', color: '#4f9b7d' },
  moderado: { label: 'Moderado', color: '#e6b45c' },
  alto: { label: 'Alto', color: '#e98b58' },
  critico: { label: 'Crítico', color: '#bf5b55' }
}

const records = [
  { id:'R-001', nombre:'Rancho La Ceiba', localidad:'Acapulco de Juárez', municipio:'Acapulco de Juárez', zona:'acapulco', lat:16.96, lng:-99.68, propietario:'Productor de ejemplo 01', perfil:{bajo:12,moderado:2,alto:3,critico:1}, fecha:'08 nov 2026' },
  { id:'R-002', nombre:'Rancho El Palmar', localidad:'Atoyac de Álvarez', municipio:'Atoyac de Álvarez', zona:'sierra', lat:17.22, lng:-100.44, propietario:'Productor de ejemplo 02', perfil:{bajo:11,moderado:2,alto:1,critico:0}, fecha:'07 nov 2026' },
  { id:'R-003', nombre:'Rancho Los Laureles', localidad:'Chilpancingo de los Bravo', municipio:'Chilpancingo de los Bravo', zona:'centro', lat:17.52, lng:-99.47, propietario:'Productor de ejemplo 03', perfil:{bajo:7,moderado:3,alto:2,critico:0}, fecha:'08 nov 2026' },
  { id:'R-004', nombre:'Rancho Monte Claro', localidad:'Iguala de la Independencia', municipio:'Iguala de la Independencia', zona:'norte', lat:18.34, lng:-99.57, propietario:'Productor de ejemplo 04', perfil:{bajo:11,moderado:2,alto:0,critico:0}, fecha:'06 nov 2026' },
  { id:'R-005', nombre:'Rancho El Arenal', localidad:'Ometepec', municipio:'Ometepec', zona:'costa-chica', lat:16.73, lng:-98.45, propietario:'Productor de ejemplo 05', perfil:{bajo:4,moderado:3,alto:3,critico:0}, fecha:'08 nov 2026' },
  { id:'R-006', nombre:'Rancho Agua Serena', localidad:'Tlapa de Comonfort', municipio:'Tlapa de Comonfort', zona:'montana', lat:17.54, lng:-98.59, propietario:'Productor de ejemplo 06', perfil:{bajo:7,moderado:2,alto:1,critico:1}, fecha:'09 nov 2026' },
  { id:'R-007', nombre:'Rancho El Manglar', localidad:'Zihuatanejo de Azueta', municipio:'Zihuatanejo de Azueta', zona:'costa-grande', lat:17.68, lng:-101.54, propietario:'Productor de ejemplo 07', perfil:{bajo:10,moderado:3,alto:2,critico:1}, fecha:'05 nov 2026' },
  { id:'R-008', nombre:'Rancho El Mirador', localidad:'Arcelia (zona demostrativa)', municipio:'Arcelia', zona:'tierra-caliente', lat:18.30, lng:-100.92, propietario:'Productor de ejemplo 08', perfil:{bajo:7,moderado:1,alto:1,critico:0}, fecha:'07 nov 2026' },
  { id:'R-009', nombre:'Rancho Las Lomas', localidad:'Sierra de Guerrero (demo)', municipio:'Ubicación ilustrativa', zona:'sierra', lat:17.90, lng:-100.80, propietario:'Productor de ejemplo 09', perfil:{bajo:6,moderado:1,alto:2,critico:0}, fecha:'09 nov 2026' }
]

/**
 * Cada animal tiene exactamente una evaluación vigente en esta maqueta.
 * En producción se contará SOLO la evaluación más reciente de cada bovino.
 * Alto y crítico significan "requieren atención", NUNCA infección confirmada.
 */
export const ranches = records.map(({perfil, ...rancho}) => {
  const animales = Object.entries(perfil).flatMap(([riesgo, cantidad]) =>
    Array.from({length:cantidad},(_,i)=>({id:`${rancho.id}-B${riesgo.slice(0,1).toUpperCase()}${i+1}`, riesgo, evaluacion:rancho.fecha}))
  )
  return {
    ...rancho,
    animales,
    bovinos: animales.length,
    alertas: animales.filter(a=>a.riesgo==='alto'||a.riesgo==='critico').length,
    criticos: animales.filter(a=>a.riesgo==='critico').length
  }
})

export const zoneMetadata = [
  {id:'costa-grande',nombre:'Costa Grande',color:'#a9ccc0'},
  {id:'tierra-caliente',nombre:'Tierra Caliente',color:'#d3d7b4'},
  {id:'sierra',nombre:'Sierra',color:'#c7d9b9'},
  {id:'norte',nombre:'Norte',color:'#a7cbd1'},
  {id:'centro',nombre:'Centro',color:'#bad3c1'},
  {id:'acapulco',nombre:'Acapulco',color:'#e9caae'},
  {id:'costa-chica',nombre:'Costa Chica',color:'#c3dacc'},
  {id:'montana',nombre:'La Montaña',color:'#c2d6df'}
]
export const dailySeries = [
  {label:'Lun', evaluaciones:12, alertas:2},
  {label:'Mar', evaluaciones:17, alertas:4},
  {label:'Mié', evaluaciones:15, alertas:3},
  {label:'Jue', evaluaciones:21, alertas:5},
  {label:'Vie', evaluaciones:18, alertas:2},
  {label:'Sáb', evaluaciones:26, alertas:6},
  {label:'Dom', evaluaciones:23, alertas:3}
]

export function countRisks(items) {
  const entries=items.flatMap(r=>r.animales)
  const counts = { bajo:0, moderado:0, alto:0, critico:0 }
  for(const a of entries) counts[a.riesgo]++
  return counts
}
export const fmt = (n)=>new Intl.NumberFormat('es-MX').format(n)
