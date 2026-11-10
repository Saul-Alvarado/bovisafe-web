import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, GeoJSON, MapContainer, Marker, Pane, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import stateOutline from '../data/guerrero-contorno.json'
import zonesOutline from '../data/zonas-ilustrativas.json'
import { zoneMetadata } from '../data/mockData'

const GUERRERO_BOUNDS = [[16.18,-102.40],[19.22,-97.83]]
const STATE_GEO_BOUNDS = L.geoJSON(stateOutline).getBounds()
// Máscara poligonal con un hueco sobre Guerrero. Oculta OSM y nombres de estados vecinos.
// El contorno es simplificado y solo está destinado a la maqueta académica.
const outsideMask = {
  type:'Feature', properties:{nombre:'Exterior de Guerrero'},
  geometry:{type:'Polygon',coordinates:[
    [[-110,12],[-90,12],[-90,23],[-110,23],[-110,12]],
    stateOutline.features[0].geometry.coordinates[0]
  ]}
}
const zoneById = Object.fromEntries(zoneMetadata.map(z=>[z.id,z]))
const zoneLabelPositions = {
  'costa-grande':[17.65,-101.25],
  'tierra-caliente':[18.26,-100.88],
  'sierra':[17.82,-100.34],
  'norte':[18.26,-99.69],
  'centro':[17.55,-99.52],
  'acapulco':[16.96,-99.90],
  'costa-chica':[16.78,-98.70],
  'montana':[17.50,-98.65]
}
const notablePlaces = [
  {id:'acapulco', nombre:'Acapulco', lat:16.853, lng:-99.823, tipo:'Ciudad clave'},
  {id:'chilpancingo', nombre:'Chilpancingo', lat:17.551, lng:-99.505, tipo:'Capital'},
  {id:'iguala', nombre:'Iguala', lat:18.344, lng:-99.538, tipo:'Cabecera'},
  {id:'zihua', nombre:'Zihuatanejo', lat:17.643, lng:-101.552, tipo:'Costa Grande'},
  {id:'tlapa', nombre:'Tlapa', lat:17.545, lng:-98.578, tipo:'La Montaña'},
  {id:'ometepec', nombre:'Ometepec', lat:16.691, lng:-98.413, tipo:'Costa Chica'},
  {id:'atoyac', nombre:'Atoyac', lat:17.206, lng:-100.433, tipo:'Sierra'},
  {id:'arcelia', nombre:'Arcelia', lat:18.317, lng:-100.287, tipo:'Tierra Caliente'}
]

function createFarmIcon(ranch, active) {
  const many = ranch.alertas > 0
  return L.divIcon({
    className:'bovisafe-map-pin',
    iconSize:[64,62],
    iconAnchor:[32,54],
    popupAnchor:[0,-43],
    html:`<div class="farm-pin ${many?'farm-pin-alert':'farm-pin-clear'} ${active?'farm-pin-active':''}">
      <div class="farm-pin-house"><svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">
         <path d="m3.5 10 8.5-7 8.5 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-7h6v7"/><path d="M7 10h2M15 10h2"/>
      </svg></div>
      <div class="farm-pin-number">${ranch.alertas}</div>
      <div class="farm-pin-tip"></div>
    </div>`
  })
}

function createZoneLabel(nombre, active=false) {
  return L.divIcon({
    className:'bovisafe-region-chip-wrap',
    iconSize:[110,30],
    iconAnchor:[55,15],
    html:`<div class="bovisafe-region-chip ${active?'bovisafe-region-chip-active':''}">${nombre}</div>`
  })
}

function MapDirector({selectedRanch, selectedZone, ranches}) {
  const map = useMap()
  useEffect(()=>{
    const updateSize = () => {
      map.invalidateSize({animate:false})
      const zoomToFit=map.getBoundsZoom(STATE_GEO_BOUNDS,false,L.point(28,28))
      map.setMinZoom(Math.max(2,zoomToFit-0.25))
    }
    updateSize()
    map.fitBounds(STATE_GEO_BOUNDS, {padding:[24,24],animate:false})
    window.addEventListener('resize',updateSize)
    return ()=>window.removeEventListener('resize',updateSize)
  },[map])
  useEffect(()=>{
    const r=ranches.find(x=>x.id===selectedRanch)
    if(r) { map.flyTo([r.lat,r.lng],Math.max(9.25, map.getZoom()),{duration:0.85});return }
    if(selectedZone) {
      const feature=zonesOutline.features.find(x=>x.properties.id===selectedZone)
      if(feature) map.flyToBounds(L.geoJSON(feature).getBounds(),{padding:[40,40],maxZoom:9.6,duration:0.8})
    }
  },[map,selectedRanch,selectedZone,ranches])
  return null
}

function MapActions({onReset}) {
  const map=useMap()
  return <div className="map-zoom-tools" aria-label="Controles del mapa">
    <button title="Acercar mapa" aria-label="Acercar mapa" type="button" onClick={()=>map.zoomIn()}>+</button>
    <button title="Alejar mapa" aria-label="Alejar mapa" type="button" onClick={()=>map.zoomOut()}>−</button>
    <button title="Volver a todo Guerrero" aria-label="Volver a todo Guerrero" type="button" onClick={()=>{onReset(); map.flyToBounds(STATE_GEO_BOUNDS,{padding:[24,24],duration:.8})}}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v7h7M21 21v-7h-7"/><path d="M4.5 9A8.5 8.5 0 0 1 19 5M19.5 15A8.5 8.5 0 0 1 5 19"/></svg>
    </button>
  </div>
}

export default function TerritoryMap({ranches,allRanches,selectedRanch,selectedZone,onSelectRanch,onSelectZone,onReset,colorMode}) {
  const [hoveredZone, setHoveredZone] = useState(null)
  const summary = useMemo(()=>Object.fromEntries(zoneMetadata.map(z=>[z.id,allRanches.filter(r=>r.zona===z.id).reduce((acc,r)=>acc+r.alertas,0)])),[allRanches])
  const ranchCountByZone = useMemo(()=>Object.fromEntries(zoneMetadata.map(z=>[z.id,allRanches.filter(r=>r.zona===z.id).length])),[allRanches])
  const modeIsRisk = colorMode==='risk'
  const fill = (id)=>{
    if(!modeIsRisk) return zoneById[id]?.color||'#b7d0bc'
    const n=summary[id]||0
    return n===0?'#d9eee0':n<=2?'#9fceb7':n<=4?'#f0c991':'#e9a394'
  }

  return <div className="territory-map-wrap">
    <MapContainer center={[17.75,-100.05]} zoom={7.8} zoomControl={false} scrollWheelZoom={true} className="territory-map" maxBounds={GUERRERO_BOUNDS} maxBoundsViscosity={1} preferCanvas={false} zoomSnap={0.25}>
      {/* Mapa base OSM: no necesita API key. No eliminar su atribución visible. */}
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <MapDirector selectedRanch={selectedRanch} selectedZone={selectedZone} ranches={ranches}/>
      {/* La máscara es opaca fuera de Guerrero y transparente dentro. */}
      <Pane name="guerrero-only-mask" style={{zIndex:415,pointerEvents:'none'}}>
        <GeoJSON data={outsideMask} interactive={false} style={{stroke:false,weight:0,fillColor:'#eaf1ec',fillOpacity:1,fillRule:'evenodd',smoothFactor:0}}/>
      </Pane>
      {zonesOutline.features.map(z=><GeoJSON
        key={`${z.properties.id}-${colorMode}-${selectedZone||'all'}`}
        data={z}
        style={{
          fillColor:fill(z.properties.id),
          fillOpacity:(selectedZone && selectedZone!==z.properties.id) ? .19 : hoveredZone===z.properties.id ? .42 : .32,
          color:selectedZone===z.properties.id?'#215b46':hoveredZone===z.properties.id?'#4e8c76':'#96b8a5',
          weight:selectedZone===z.properties.id?2.8:hoveredZone===z.properties.id?2.25:1.25,
          dashArray:selectedZone===z.properties.id?'':'4 6',
          opacity:1
        }}
        eventHandlers={{
          click:()=>onSelectZone(z.properties.id),
          mouseover:()=>setHoveredZone(z.properties.id),
          mouseout:()=>setHoveredZone(null)
        }}
        onEachFeature={(feature, layer)=>{
          const id = feature.properties.id
          const label = zoneById[id]?.nombre || feature.properties.nombre
          const alertas = summary[id] || 0
          const ranchos = ranchCountByZone[id] || 0
          layer.bindTooltip(`<div class="map-zone-tooltip"><strong>${label}</strong><span>${ranchos} ranchos ficticios</span><span>${alertas} bovinos con alertas</span></div>`, {sticky:true, direction:'top', opacity:1})
        }}
      />)}
      <GeoJSON data={stateOutline} interactive={false} style={{fillOpacity:0,color:'#4a7864',weight:3.2,opacity:.95}} />

      {Object.entries(zoneLabelPositions).map(([id, coords])=><Marker key={id} position={coords} icon={createZoneLabel(zoneById[id].nombre, selectedZone===id)} interactive={false} />)}

      {notablePlaces.map(place=><CircleMarker key={place.id} center={[place.lat, place.lng]} radius={4.8} pathOptions={{color:'#4b7e65', weight:1.3, fillColor:'#ffffff', fillOpacity:1}}>
        <Tooltip permanent direction="top" offset={[0,-6]} className="city-label-tooltip">{place.nombre}</Tooltip>
      </CircleMarker>)}

      {ranches.map(r=><Marker key={`${r.id}-${selectedRanch===r.id?'active':'idle'}`} position={[r.lat,r.lng]} icon={createFarmIcon(r, selectedRanch===r.id)} eventHandlers={{click:()=>onSelectRanch(r.id)}}>
        <Popup className="farm-popup"><div className="popup-content">
          <span className="popup-eyebrow">RANCHO · DATOS FICTICIOS</span>
          <h3>{r.nombre}</h3>
          <p>{r.localidad}, Guerrero</p>
          <div className="popup-stat-line"><span>Bovinos evaluados</span><strong>{r.bovinos}</strong></div>
          <div className="popup-stat-line"><span>Con riesgo alto o crítico</span><strong className={r.alertas?'text-danger':'text-green'}>{r.alertas}</strong></div>
          <small>Última evaluación: {r.fecha}</small>
        </div></Popup>
      </Marker>)}

      <MapActions onReset={onReset}/>
    </MapContainer>
    <div className="map-scope-label">Solo Guerrero <span>· vista recortada</span></div>
    <div className="map-compass" aria-hidden="true"><span>N</span><i>↑</i></div>
    <div className="map-corner-label">GUERRERO <span>• TERRITORIO OBSERVADO</span></div>
    <div className="map-legend map-legend-enhanced">
      <span><i className="legend-farm-icon">⌂</i> Rancho</span>
      <span><i className="legend-alert-dot"/> Riesgo alto / crítico</span>
      <span><i className="legend-boundary"/> Regiones</span>
    </div>
  </div>
}
