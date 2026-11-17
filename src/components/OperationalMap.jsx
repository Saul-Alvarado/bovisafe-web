import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, GeoJSON, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import pointOnFeature from '@turf/point-on-feature'
import '../styles/surveillance-map.css'

const paths={
 farm:'m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8M7 10h2m6 0h2',
 cow:'M4 8h12l3 3v5h-2v4h-2v-4H8v4H6v-4H4V8Zm0 0V5L2 4M16 8l1-3h3l2 3v5h-3M18 5l-1-2m4 2 1-2M19 9h.1',
 shield:'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7l-9-4Zm-4 9 3 3 5-6',
 alert:'m12 3 10 18H2L12 3Zm0 6v5m0 3v.1',
 location:'M19 10c0 5-7 12-7 12S5 15 5 10a7 7 0 0 1 14 0ZM9 10a3 3 0 1 0 6 0 3 3 0 0 0-6 0',
 history:'M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v6l4 2',
 reset:'M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6',
}
function Icon({name,...props}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]||paths.farm}/></svg>}
const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.farm}"/></svg>`
const amount=value=>Math.max(0,Number(value)||0)
const number=value=>amount(value).toLocaleString('es-MX')
const tones={registered:{label:'Sin alertas registradas',short:'Registro',icon:'farm'},visual:{label:'Evaluación compatible con miasis',short:'Compatibilidad visual',icon:'alert'},suspected:{label:'Sospecha profesional registrada',short:'Sospecha profesional',icon:'alert'},confirmed:{label:'Diagnóstico veterinario confirmado',short:'Confirmación veterinaria',icon:'shield'}}
export function surveillanceTone(p){return amount(p?.confirmed_cases)>0?'confirmed':amount(p?.suspected_cases)>0?'suspected':amount(p?.nws_predictions)>0?'visual':'registered'}

function Director({bounds,selected,municipalities,onZoom}){
 const map=useMap()
 useEffect(()=>{
  let fullView=true
  const resize=()=>{map.invalidateSize({pan:false});map.setMinZoom(0);const min=Math.floor(map.getBoundsZoom(bounds,false,L.point(32,32)));map.setMinZoom(min);if(fullView||map.getZoom()<min)map.fitBounds(bounds,{padding:[18,18],animate:false});map.panInsideBounds(bounds,{animate:false})}
  const observer=new ResizeObserver(resize);observer.observe(map.getContainer());resize()
  const update=()=>{const el=map.getContainer();el.dataset.zoom=String(map.getZoom());el.dataset.center=JSON.stringify([map.getCenter().lat,map.getCenter().lng]);el.dataset.fitZoom=String(map.getBoundsZoom(bounds,false,L.point(36,36)));fullView=map.getBounds().contains(bounds);el.dataset.stateFits=String(fullView);onZoom(map.getZoom())}
  map.on('moveend zoomend resize',update);update()
  return()=>{observer.disconnect();map.off('moveend zoomend resize',update)}
 },[map,bounds,onZoom])
 useEffect(()=>{if(selected){const f=municipalities.features.find(f=>f.properties.code===selected);if(f)map.fitBounds(L.geoJSON(f).getBounds(),{padding:[28,28],maxZoom:10,animate:!matchMedia('(prefers-reduced-motion: reduce)').matches,duration:.6})}},[map,selected,municipalities])
 return null
}

/** Mask in viewport pixels: no world-sized SVG coordinates, wrapping or tile-sized polygons. */
function StateMask({state}){
 const map=useMap()
 useEffect(()=>{
  const namespace='http://www.w3.org/2000/svg',svg=document.createElementNS(namespace,'svg'),path=document.createElementNS(namespace,'path')
  svg.classList.add('state-viewport-mask');svg.setAttribute('aria-hidden','true');path.setAttribute('fill-rule','evenodd');svg.append(path);const pane=map.getPane('state-mask')||map.createPane('state-mask');pane.style.zIndex='450';pane.style.pointerEvents='none';pane.append(svg)
  const polygons=state.features[0].geometry.type==='MultiPolygon'?state.features[0].geometry.coordinates:[state.features[0].geometry.coordinates]
  const update=()=>{
   const size=map.getSize();L.DomUtil.setPosition(svg,map.containerPointToLayerPoint([0,0]));svg.setAttribute('width',size.x);svg.setAttribute('height',size.y);svg.setAttribute('viewBox',`0 0 ${size.x} ${size.y}`)
   let d=`M0 0H${size.x}V${size.y}H0Z`
   for(const polygon of polygons)for(const ring of polygon){d+=ring.map(([lng,lat],i)=>{const p=map.latLngToContainerPoint([lat,lng]);return `${i?'L':'M'}${p.x},${p.y}`}).join('')+'Z'}
   path.setAttribute('d',d)
  }
  map.on('move zoom resize viewreset',update);update()
  return()=>{map.off('move zoom resize viewreset',update);svg.remove()}
 },[map,state]);return null
}
function RanchMarkers({features,state,onSelect,selected,municipal}){
 const map=useMap(),groupRef=useRef(null)
 useEffect(()=>{
  const group=L.markerClusterGroup({maxClusterRadius:62,showCoverageOnHover:false,spiderfyOnMaxZoom:true,removeOutsideVisibleBounds:true,iconCreateFunction:cluster=>{
   const children=cluster.getAllChildMarkers(),p={};for(const marker of children){const row=marker.options.record;for(const key of ['confirmed_cases','suspected_cases','nws_predictions','registered_animals'])p[key]=(p[key]||0)+amount(row[key])}
   const tone=surveillanceTone(p)
   return L.divIcon({className:`bovine-cluster marker-cluster tone-${tone}`,html:`<div>${svg('farm')}<strong>${children.length}</strong><small>${municipal?'municipios':'ranchos'}</small><span class="cluster-herd">${svg('cow')}<b>${number(p.registered_animals)}</b></span></div>`,iconSize:[72,88],iconAnchor:[36,44]})
  }})
  for(const f of features){
   if(f.geometry?.type!=='Point'||!booleanPointInPolygon(f.geometry.coordinates,state.features[0]))continue
   const p=f.properties,tone=surveillanceTone(p),alert=amount(p.confirmed_cases)||amount(p.suspected_cases)||amount(p.nws_animals),kind=municipal?'municipality':'ranch'
   const cohorts=[['visual',amount(p.nws_animals),'con evaluación compatible'],['suspected',amount(p.suspected_animals),'con sospecha profesional'],['confirmed',amount(p.confirmed_animals),'con diagnóstico veterinario confirmado']].filter(([,count])=>count>0)
   const cattle=cohorts.map(([status,count,label])=>`<span class="herd-cohort tone-${status}" title="${count} bovinos ${label}">${Array.from({length:Math.min(count,2)},()=>svg('cow')).join('')}<b>${number(count)}</b>${status==='confirmed'?svg('shield'):svg('alert')}</span>`).join('')
   const marker=L.marker([f.geometry.coordinates[1],f.geometry.coordinates[0]],{record:p,featureId:f.id,title:municipal?`Agregado municipal: ${p.municipality_name}`:p.ranch_name,keyboard:true,
    icon:L.divIcon({className:`operational-marker livestock-pin tone-${tone} ${String(selected)===String(f.id)?'pin-selected':''}`,iconSize:[112,104],iconAnchor:[56,64],
     html:`<div class="livestock-house">${svg('farm')}${municipal?'<i class="aggregate-symbol">M</i>':''}${alert?`<b class="livestock-alert">${svg(tones[tone].icon)}<span>${alert}</span></b>`:''}</div><div class="livestock-count">${svg('cow')}<strong>${number(p.registered_animals)}</strong></div><i class="livestock-point"></i><div class="herd-cohorts">${cattle}</div>`})})
   marker.on('click',()=>onSelect({...p,id:f.id,kind}));marker.bindTooltip(municipal?`Agregado de ${p.municipality_name}`:p.ranch_name,{direction:'top',offset:[0,-58],className:'livestock-tooltip'});group.addLayer(marker)
  }
  groupRef.current=group;map.addLayer(group);return()=>{group.eachLayer(layer=>{layer.closeTooltip();layer.unbindTooltip();layer.off()});group.clearLayers();map.removeLayer(group);groupRef.current=null}
 },[map,features,state,onSelect,municipal]);
 useEffect(()=>{groupRef.current?.eachLayer(layer=>layer.getElement()?.classList.toggle('pin-selected',String(layer.options.featureId)===String(selected)))},[selected]);return null
}
function Metric({icon='cow',value,label,tone}){return <div className={'territory-value '+(tone?'value-'+tone:'')}><Icon name={icon}/><strong>{number(value)}</strong><span>{label}</span></div>}
function DetailPanel({record,selectedMunicipality,geography,snapshot,authorized,onHistory}){
 const municipality=geography.municipalities.features.find(f=>f.properties.code===selectedMunicipality)
 const row=record||(municipality?{...snapshot?.municipalities?.find(m=>m.code===selectedMunicipality),municipality_name:municipality.properties.name,kind:'municipality'}:null)
 if(!row)return <aside className="territory-panel" aria-label="Información territorial"><span className="territory-eyebrow">LECTURA DEL TERRITORIO</span><Icon className="panel-intro-icon" name="farm"/><h3>El territorio, con contexto.</h3><p>Selecciona un municipio o un marcador para consultar sus bovinos y registros sanitarios del periodo.</p><div className="territory-privacy"><Icon name="shield"/><span>{authorized?'Solo ves ubicaciones de tu cuenta o con autorización veterinaria.':'Vista pública por municipio. Los marcadores representan municipios, nunca direcciones particulares.'}</span></div><small>Sin registros, no hay marcadores ni alertas de ejemplo.</small><div className="panel-source">Geografía real INEGI<br/>Calles y localidades de OpenStreetMap</div></aside>
 const tone=surveillanceTone(row),ranch=row.kind==='ranch'
 return <aside className="territory-panel detail-panel" aria-label={ranch?'Detalle del rancho':'Detalle municipal'}>
  <span className="territory-eyebrow">{ranch?'RANCHO AUTORIZADO':'AGREGADO MUNICIPAL'}</span><div className={'panel-title-icon tone-'+tone}><Icon name="farm"/></div>
  <h3>{ranch?row.ranch_name:row.municipality_name}</h3><p className="panel-location"><Icon name="location"/>{ranch?`${row.municipality_name||'Municipio sin registrar'}, Guerrero`:'Guerrero · referencia municipal, no dirección de rancho'}</p>
  <div className={'surveillance-status tone-'+tone}><Icon name={tones[tone].icon}/>{tones[tone].label}</div>
  {!ranch&&<p className="aggregate-explanation">{number(row.ranches)} ranchos con evaluaciones sanitarias del periodo. El símbolo es un punto representativo del polígono oficial.</p>}
  <div className="registered-herd"><Icon name="cow"/><strong>{number(row.registered_animals)}</strong><span>bovinos registrados</span></div>
  <div className="territory-detail-grid"><Metric value={row.animals} label="bovinos evaluados"/><Metric value={row.nws_animals} label="bovinos con evaluación compatible" tone="visual"/><Metric value={row.suspected_animals} label="bovinos con sospecha profesional" tone="suspected"/><Metric icon="shield" value={row.confirmed_animals} label="bovinos con diagnóstico confirmado" tone="confirmed"/></div>
  <dl className="territory-case-list"><div><dt>Evaluaciones sanitarias válidas</dt><dd>{number(row.evaluations)}</dd></div><div><dt>Casos sospechosos</dt><dd>{number(row.suspected_cases)}</dd></div><div><dt>Diagnósticos confirmados</dt><dd>{number(row.confirmed_cases)}</dd></div><div><dt>Casos en seguimiento</dt><dd>{number(row.follow_up_cases)}</dd></div><div><dt>Bovinos en seguimiento</dt><dd>{number(row.follow_up_animals)}</dd></div></dl>
  <span className="sr-only">{number(row.evaluations)} evaluaciones sanitarias válidas</span>
  {ranch&&row.last_evaluation_at&&<p className="last-evaluation"><Icon name="history"/>Última evaluación: {new Date(row.last_evaluation_at.endsWith('Z')?row.last_evaluation_at:row.last_evaluation_at+'Z').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}</p>}
  {ranch&&onHistory&&<button className="territory-history" onClick={()=>onHistory(row.ranch_id)}><Icon name="history"/>Consultar evaluaciones</button>}
  <p className="territory-note">{ranch?'Los bovinos están asociados al rancho; no son posiciones GPS individuales.':'El agregado no identifica propietarios ni ubicaciones particulares.'} Una predicción visual no es un diagnóstico.</p>
 </aside>
}
export default function OperationalMap({geography,snapshot,selectedMunicipality,onMunicipality,authorized=false,busy=false,onHistory}){
 const mapSnapshot=snapshot?.territorial||snapshot
 const [map,setMap]=useState(null),[zoom,setZoom]=useState(7),[selected,setSelected]=useState(null),[tilesUnavailable,setTilesUnavailable]=useState(false),[streets,setStreets]=useState(true)
 const geo=geography?.state,municipalities=geography?.municipalities,boundsRef=useRef(null)
 const privateFeatures=authorized?mapSnapshot?.map?.features||[]:[]
 const features=useMemo(()=>{
  if(authorized)return privateFeatures
  if(!municipalities||!mapSnapshot)return []
  const minimum=Math.max(1,Number(mapSnapshot.publicMarkerMinimumRanches)||1)
  return (mapSnapshot.municipalities||[]).filter(row=>amount(row.ranches)>=minimum&&amount(row.evaluations)>0).flatMap(row=>{
   const polygon=municipalities.features.find(f=>f.properties.code===row.code);if(!polygon)return []
   return [{type:'Feature',id:row.code,geometry:pointOnFeature(polygon).geometry,properties:{...row,municipality:row.code,municipality_name:row.name}}]
  })
 },[authorized,mapSnapshot,municipalities])
 useEffect(()=>setSelected(null),[snapshot,selectedMunicipality])
 const choose=useRef(null);choose.current=setSelected
 const selectRef=useRef(record=>choose.current(record))
 if(geo&&!boundsRef.current)boundsRef.current=L.geoJSON(geo).getBounds()
 if(!geo||!municipalities)return <div className="map-placeholder" role="status">Cargando cartografía oficial de Guerrero…</div>
 const bounds=boundsRef.current,totals=new Map((mapSnapshot?.municipalities||[]).map(row=>[row.code,row])),summary=mapSnapshot?.summary
 function style(f){const row=totals.get(f.properties.code),tone=surveillanceTone(row),active=f.properties.code===selectedMunicipality;return {color:active?'#1d5c47':'#6c9783',weight:active?2.8:zoom>10?.7:1,opacity:active?1:.62,fillColor:tone==='confirmed'?'#d45e50':tone==='suspected'?'#df903e':tone==='visual'?'#e0ae51':'#c8dfce',fillOpacity:amount(row?.evaluations)>0?.15:.025}}
 return <div className="operative-map-shell surveillance-map">
  <div className="territory-heading"><div><span className="territory-eyebrow">VIGILANCIA SANITARIA BOVINA</span><h3>Guerrero, un territorio que cuidamos.</h3><p>{authorized?'Ubicaciones autorizadas y seguimiento por rancho.':'Información municipal agregada. Las ubicaciones privadas están protegidas.'}</p></div><span className={'territory-live '+(busy?'is-loading':'')}><i/>{busy?'Consultando registros':'Datos del periodo'}</span></div>
  <div className="territory-ribbon"><Metric icon="farm" value={summary?.ranches} label="ranchos evaluados"/><Metric value={summary?.registered_animals} label="bovinos registrados en esos ranchos"/><Metric value={summary?.animals} label="bovinos evaluados sanitariamente"/><Metric icon="shield" value={summary?.confirmed_cases} label="diagnósticos veterinarios" tone="confirmed"/></div>
  <div className="operative-map-toolbar"><span><Icon name="location"/>Guerrero · {authorized?'ubicaciones autorizadas':'agregados por municipio'}<small>{zoom>=10?'Vista de proximidad':'Vista territorial'}</small></span><div><button aria-pressed={streets} onClick={()=>setStreets(v=>!v)}>{streets?'Ocultar calles':'Mostrar calles'}</button><button type="button" onClick={()=>{setSelected(null);map?.fitBounds(bounds,{padding:[18,18],animate:true})}}><Icon name="reset"/>Restablecer vista completa</button></div></div>
  <p className="territory-context-note">Los colores conservan los registros del periodo. Seleccionar un municipio resalta su límite sin borrar alertas de otros municipios.</p>
  <div className={'territory-workspace '+(zoom>=10?'proximity-view':'overview-view')}>
   <div className="territory-map-stage">
    <MapContainer ref={setMap} bounds={bounds} boundsOptions={{padding:[18,18]}} maxBounds={bounds.pad(.015)} maxBoundsViscosity={1} maxZoom={18} zoomSnap={.25} zoomDelta={.5} wheelPxPerZoomLevel={140} scrollWheelZoom touchZoom dragging inertia={false} worldCopyJump={false} className="operative-map" attributionControl={false}>
     {streets&&<TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} bounds={bounds} eventHandlers={{tileerror:()=>setTilesUnavailable(true)}} noWrap keepBuffer={1} updateWhenIdle updateWhenZooming={false}/>}
     <Director bounds={bounds} selected={selectedMunicipality} municipalities={municipalities} onZoom={setZoom}/>
     <GeoJSON key={selectedMunicipality+'-'+JSON.stringify(mapSnapshot?.municipalities)+'-'+(zoom>=10)} data={municipalities} style={style} onEachFeature={(feature,layer)=>{
      layer.on('click',()=>onMunicipality(feature.properties.code));const label=document.createElement('span');label.textContent=feature.properties.name;layer.bindTooltip(label,{sticky:true,direction:'top',className:'municipality-tooltip'})
     }}/>
     <GeoJSON data={geo} style={{color:'#265b47',weight:2.4,fill:false,interactive:false}} interactive={false}/>
     <StateMask state={geo}/>
     <RanchMarkers features={features} state={geo} onSelect={selectRef.current} selected={selected?.id} municipal={!authorized}/>
    </MapContainer>
    <span className="territory-level"><Icon name={authorized?'farm':'shield'}/>{authorized?'Ranchos autorizados':'Agregados municipales'}</span>
    {busy&&<span className="map-loading" role="status">Consultando registros…</span>}
    <div className="territory-compass" aria-hidden="true">N<span>↑</span></div>
   </div>
   <DetailPanel record={selected} selectedMunicipality={selectedMunicipality} geography={geography} snapshot={mapSnapshot} authorized={authorized} onHistory={onHistory}/>
  </div>
  <p className="map-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · INEGI · 85 municipios · Calles y localidades reales.</p>
  {tilesUnavailable&&<p className="tile-status" role="status">Algunas calles no pudieron cargarse. Los límites oficiales y los registros siguen disponibles.</p>}
  {!busy&&snapshot&&amount(summary?.evaluations)===0&&<div className="map-empty" role="status"><Icon name="farm"/><div><strong>Actualmente no hay evaluaciones registradas para el periodo seleccionado.</strong><span>Los ranchos y las alertas aparecerán cuando existan evaluaciones sanitarias válidas y ubicaciones autorizadas.</span></div></div>}
  {authorized&&amount(snapshot?.unlocatedRanches)>0&&<p className="territory-unlocated">{snapshot.unlocatedRanches} ranchos evaluados sin coordenadas válidas dentro de Guerrero. No se les asigna una ubicación aproximada.</p>}
  <div className="territory-legend" aria-label="Simbología de vigilancia"><span><Icon name="farm"/>Rancho / agregado municipal</span><span><Icon name="cow"/>Bovinos asociados</span><span className="tone-visual"><Icon name="alert"/>Compatibilidad visual</span><span className="tone-suspected"><Icon name="alert"/>Sospecha profesional</span><span className="tone-confirmed"><Icon name="shield"/>Diagnóstico confirmado</span><span><i className="empty-area"/>Sin evaluaciones</span></div>
  <details className="territory-method"><summary>Cómo leer los símbolos y las cantidades</summary><p>La burbuja con la vaca indica bovinos registrados en los ranchos representados. La insignia ámbar cuenta bovinos únicos con evaluación compatible; naranja cuenta casos sospechosos; rojo cuenta diagnósticos veterinarios. La tarjeta distingue animales, fotografías y casos. Se dibujan hasta dos siluetas por grupo; la cifra indica el total. Un mismo bovino puede aparecer en varios estados y esas cifras no deben sumarse. Los grupos cuentan ranchos o municipios, nunca posiciones individuales de bovinos.</p><p>Los agregados públicos aparecen solo con evaluaciones sanitarias válidas, en un punto representativo calculado con point-on-feature sobre el municipio INEGI; no es una ubicación de rancho ni una coordenada capturada. No se dibujan límites regionales sin una fuente verificada. Los filtros respetan las regiones declaradas.</p></details>
 </div>
}
