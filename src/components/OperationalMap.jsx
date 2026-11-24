import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
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
 layers:'m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5',
 close:'M6 6l12 12M18 6 6 18',
}
function Icon({name,...props}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]||paths.farm}/></svg>}
const svg=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.farm}"/></svg>`
const amount=value=>Math.max(0,Number(value)||0)
const number=value=>amount(value).toLocaleString('es-MX')
const escapeHtml=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const reducedMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches
const tones={registered:{label:'Sin alertas registradas',short:'Registro',icon:'farm'},visual:{label:'Evaluación compatible con miasis',short:'Compatibilidad visual',icon:'alert'},suspected:{label:'Sospecha profesional registrada',short:'Sospecha profesional',icon:'alert'},confirmed:{label:'Diagnóstico veterinario confirmado',short:'Confirmación veterinaria',icon:'shield'}}
export function surveillanceTone(p){return amount(p?.confirmed_cases)>0?'confirmed':amount(p?.suspected_cases)>0?'suspected':amount(p?.nws_predictions)>0?'visual':'registered'}

/** Territorial palette: one hue per sanitary level, translucent so streets and localities stay legible. */
const FILL={registered:'#5f9f7d',visual:'#e0ae51',suspected:'#df903e',confirmed:'#d45e50'}
const FILL_OPACITY={registered:.2,visual:.3,suspected:.32,confirmed:.34}
const STATE_PADDING=[18,18]
/** Ends any running pan/zoom and settles inside maxBounds synchronously, so a pending bounce cannot cancel the next flight. */
function settle(map){map.stop();const limit=map.options.maxBounds;if(limit&&!limit.contains(map.getCenter()))map.panInsideBounds(limit,{animate:false})}

function municipalityStyle(feature,{totals,zoom}){
 const row=totals.get(feature.properties.code),active=amount(row?.evaluations)>0,tone=surveillanceTone(row),close=zoom>=10
 return {color:'#2c6a52',weight:close?1.2:.8,opacity:close?.75:.55,fillColor:active?FILL[tone]:'#ffffff',fillOpacity:active?FILL_OPACITY[tone]:.04,lineJoin:'round'}
}

/** Keeps Guerrero as the protagonist: fits once, refits only on resize when the full state was in view, never recenters on data refresh. */
function Director({bounds,selected,municipalities,onZoom}){
 const map=useMap(),previous=useRef(selected)
 useEffect(()=>{
  let fullView=true,frame=0
  const minimum=()=>{const saved=map.options.minZoom;map.options.minZoom=0;const min=Math.floor(map.getBoundsZoom(bounds,false,L.point(32,32))*4)/4;map.options.minZoom=saved;return min}
  const resize=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
   map.invalidateSize({pan:false,debounceMoveend:true});const min=minimum();if(map.getMinZoom()!==min)map.setMinZoom(min)
   if(fullView||map.getZoom()<min)map.fitBounds(bounds,{padding:STATE_PADDING,animate:false})
  })}
  const observer=new ResizeObserver(resize);observer.observe(map.getContainer());map.setMinZoom(minimum())
  const update=()=>{const el=map.getContainer(),center=map.getCenter();el.dataset.zoom=String(map.getZoom());el.dataset.center=JSON.stringify([center.lat,center.lng]);el.dataset.fitZoom=String(map.getBoundsZoom(bounds,false,L.point(36,36)));fullView=map.getBounds().pad(.002).contains(bounds);el.dataset.stateFits=String(fullView);onZoom(map.getZoom())}
  map.on('moveend zoomend',update);update()
  return()=>{cancelAnimationFrame(frame);observer.disconnect();map.off('moveend zoomend',update)}
 },[map,bounds,onZoom])
 useEffect(()=>{
  const before=previous.current;previous.current=selected;if(before===selected)return
  const animate=!reducedMotion()
  settle(map);if(!selected){if(before)map.flyToBounds(bounds,{padding:STATE_PADDING,duration:.6,animate});return}
  const feature=municipalities.features.find(f=>f.properties.code===selected);if(!feature)return
  const target=L.geoJSON(feature).getBounds()
  // Selecting a municipality that is already comfortably in view does not move the camera.
  if(map.getBounds().contains(target)&&map.getZoom()>=map.getBoundsZoom(target,false,L.point(56,56))-1.5)return
  map.flyToBounds(target,{padding:[36,36],maxZoom:10,duration:.7,animate})
 },[map,selected,municipalities,bounds])
 return null
}

/** Viewport mask drawn in pixels with a margin, transformed during zoom animations to avoid flashes. */
function StateMask({state}){
 const map=useMap()
 useEffect(()=>{
  const namespace='http://www.w3.org/2000/svg',svgEl=document.createElementNS(namespace,'svg'),path=document.createElementNS(namespace,'path')
  svgEl.classList.add('state-viewport-mask','leaflet-zoom-animated');svgEl.setAttribute('aria-hidden','true');path.setAttribute('fill-rule','evenodd');svgEl.append(path)
  const pane=map.getPane('state-mask')||map.createPane('state-mask');pane.style.zIndex='450';pane.style.pointerEvents='none';pane.append(svgEl)
  const geometry=state.features[0].geometry,polygons=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates]
  const MARGIN=.5
  const update=()=>{
   const size=map.getSize(),mx=Math.round(size.x*MARGIN),my=Math.round(size.y*MARGIN),w=size.x+2*mx,h=size.y+2*my
   const origin=map.containerPointToLayerPoint([-mx,-my]);L.DomUtil.setPosition(svgEl,origin)
   svgEl.setAttribute('width',w);svgEl.setAttribute('height',h);svgEl.setAttribute('viewBox',`0 0 ${w} ${h}`)
   let d=`M0 0H${w}V${h}H0Z`
   for(const polygon of polygons)for(const ring of polygon){d+=ring.map(([lng,lat],i)=>{const p=map.latLngToContainerPoint([lat,lng]);return `${i?'L':'M'}${(p.x+mx).toFixed(1)},${(p.y+my).toFixed(1)}`}).join('')+'Z'}
   path.setAttribute('d',d)
  }
  const animate=e=>{
   const size=map.getSize(),mx=Math.round(size.x*MARGIN),my=Math.round(size.y*MARGIN)
   const scale=map.getZoomScale(e.zoom),topLeft=map.containerPointToLatLng([-mx,-my]),offset=map._latLngToNewLayerPoint(topLeft,e.zoom,e.center)
   L.DomUtil.setTransform(svgEl,offset,scale)
  }
  map.on('move zoom resize viewreset zoomend',update);if(map.options.zoomAnimation)map.on('zoomanim',animate);update()
  return()=>{map.off('move zoom resize viewreset zoomend',update);map.off('zoomanim',animate);svgEl.remove()}
 },[map,state]);return null
}

/** The 85 official municipalities are created once; data, selection and zoom only restyle them. */
function MunicipalityLayer({municipalities,totals,selected,zoom,onSelect}){
 const map=useMap(),layerRef=useRef(null),highlightRef=useRef(null),context=useRef({totals,zoom}),selectRef=useRef(onSelect)
 context.current={totals,zoom};selectRef.current=onSelect
 useEffect(()=>{
  const pane=map.getPane('municipal-selection')||map.createPane('municipal-selection');pane.style.zIndex='420';pane.style.pointerEvents='none'
  const layer=L.geoJSON(municipalities,{style:f=>municipalityStyle(f,context.current),onEachFeature:(feature,item)=>{
   item.on('click',()=>selectRef.current(feature.properties.code))
   item.on('mouseover',()=>{const base=municipalityStyle(feature,context.current);item.setStyle({weight:base.weight+1.4,opacity:.95,color:'#174b39',fillOpacity:Math.min(.5,base.fillOpacity+.12)})})
   item.on('mouseout',()=>item.setStyle(municipalityStyle(feature,context.current)))
   item.bindTooltip(()=>{const row=context.current.totals.get(feature.properties.code),box=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('span');name.textContent=feature.properties.name;detail.textContent=amount(row?.evaluations)?`${number(row.evaluations)} evaluaciones · ${number(row.animals)} bovinos evaluados`:'Sin evaluaciones en el periodo';box.append(name,detail);return box},{sticky:true,direction:'top',offset:[0,-8],className:'municipality-tooltip',opacity:1})
  }})
  layer.addTo(map);layerRef.current=layer
  return()=>{layer.eachLayer(item=>{item.unbindTooltip();item.off()});layer.remove();layerRef.current=null}
 },[map,municipalities])
 useEffect(()=>{layerRef.current?.setStyle(f=>municipalityStyle(f,context.current))},[totals,zoom])
 useEffect(()=>{
  highlightRef.current?.remove();highlightRef.current=null
  const feature=selected&&municipalities.features.find(f=>f.properties.code===selected)
  if(feature){highlightRef.current=L.geoJSON(feature,{pane:'municipal-selection',interactive:false,style:{color:'#0f3d2e',weight:3,opacity:1,fill:true,fillColor:'#0f3d2e',fillOpacity:.06,lineJoin:'round'}}).addTo(map)}
  return()=>{highlightRef.current?.remove();highlightRef.current=null}
 },[map,selected,municipalities])
 return null
}

function StateOutline({state}){
 const map=useMap()
 useEffect(()=>{
  const pane=map.getPane('state-outline')||map.createPane('state-outline');pane.style.zIndex='455';pane.style.pointerEvents='none'
  const halo=L.geoJSON(state,{pane:'state-outline',interactive:false,style:{color:'#1f5f4a',weight:9,opacity:.12,fill:false,lineJoin:'round'}}).addTo(map)
  const line=L.geoJSON(state,{pane:'state-outline',interactive:false,style:{color:'#1a5641',weight:2.4,opacity:1,fill:false,lineJoin:'round'}}).addTo(map)
  return()=>{halo.remove();line.remove()}
 },[map,state]);return null
}

function markerHtml(p,tone,municipal){
 const alert=amount(p.confirmed_cases)||amount(p.suspected_cases)||amount(p.nws_animals)
 const cohorts=[['visual',amount(p.nws_animals),'con evaluación compatible'],['suspected',amount(p.suspected_animals),'con sospecha profesional'],['confirmed',amount(p.confirmed_animals),'con diagnóstico veterinario confirmado']].filter(([,count])=>count>0)
 const cattle=cohorts.map(([status,count,label])=>`<span class="herd-cohort tone-${status}" title="${count} bovinos ${label}">${Array.from({length:Math.min(count,2)},()=>svg('cow')).join('')}<b>${number(count)}</b>${status==='confirmed'?svg('shield'):svg('alert')}</span>`).join('')
 return `<div class="livestock-house">${svg('farm')}${municipal?'<i class="aggregate-symbol">M</i>':''}</div>${alert?`<b class="livestock-alert">${svg(tones[tone].icon)}<span>${alert}</span></b>`:''}<i class="livestock-point"></i><div class="livestock-count">${svg('cow')}<strong>${number(p.registered_animals)}</strong></div><div class="herd-cohorts">${cattle}</div>`
}

/** One cluster group per view mode; data refreshes swap markers without recreating the group (no flicker). */
function inventoryHtml(p){
 return `<div class="livestock-house">${svg('farm')}<i class="aggregate-symbol">M</i></div><i class="livestock-point"></i><div class="livestock-count">${svg('cow')}<strong>${number(p.registered_animals)}</strong></div>`
}
/** What one marker shows; markers are only touched when this changes. */
function markerView(f,variant,municipal){
 const p=f.properties
 if(variant==='inventory'){
  const name=`Inventario municipal: ${p.municipality_name}`
  return {tone:'inventory',kind:'inventory',name,html:inventoryHtml(p),tooltip:`<strong>${escapeHtml(p.municipality_name)}</strong><span>${number(p.ranches)} ${amount(p.ranches)===1?'rancho registrado':'ranchos registrados'} sin evaluaciones en el periodo · ${number(p.registered_animals)} bovinos registrados</span>`}
 }
 const tone=surveillanceTone(p),name=municipal?`Agregado municipal: ${p.municipality_name}`:p.ranch_name
 return {tone,kind:municipal?'municipality':'ranch',name,html:markerHtml(p,tone,municipal),tooltip:`<strong>${escapeHtml(municipal?p.municipality_name:p.ranch_name)}</strong><span>${number(p.registered_animals)} bovinos registrados · ${number(p.evaluations)} evaluaciones</span>`}
}
const pinIcon=(view,selected)=>L.divIcon({className:`operational-marker livestock-pin tone-${view.tone}${selected?' pin-selected':''}`,iconSize:[104,96],iconAnchor:[52,50],html:view.html})

/**
 * Leaflet.markercluster builds its grid from Math.floor(minZoom) but starts rendering from the raw minZoom.
 * Guerrero's fitted minimum zoom is fractional (e.g. 8.25), so the top level (7) was skipped and every
 * isolated marker attached to it (a municipality with no other evaluated neighbour, such as Ometepec)
 * was never drawn. Our groups use a cluster class that floors that start level, as the library does elsewhere.
 */
const integerZoomClusters=new Map()
function withIntegerMinZoom(group){
 const Base=group._markerCluster
 if(!integerZoomClusters.has(Base))integerZoomClusters.set(Base,Base.extend({_recursively(bounds,start,stop,everyLevel,bottomLevel){return Base.prototype._recursively.call(this,bounds,Math.floor(start),stop,everyLevel,bottomLevel)}}))
 group._markerCluster=integerZoomClusters.get(Base)
 return group
}

/**
 * One persistent cluster group per layer. Refreshes are diffed by feature id: existing markers keep
 * their DOM element and only change icon, counts or position; new ones are added and vanished ones
 * removed, so a data update never empties the map or duplicates a marker.
 */
function RanchMarkers({features,state,onSelect,selected,municipal,variant='surveillance'}){
 const map=useMap(),groupRef=useRef(null),markersRef=useRef(new Map()),selectedRef=useRef(selected),selectRef=useRef(onSelect)
 selectedRef.current=selected;selectRef.current=onSelect
 const signature=useMemo(()=>JSON.stringify(features.map(f=>[f.id,f.geometry?.coordinates,f.properties])),[features])
 const featuresRef=useRef(features);featuresRef.current=features
 useEffect(()=>{
  const inventory=variant==='inventory'
  const group=L.markerClusterGroup({maxClusterRadius:zoom=>zoom>=11?44:62,showCoverageOnHover:false,spiderfyOnMaxZoom:true,removeOutsideVisibleBounds:true,animate:!reducedMotion(),chunkedLoading:true,iconCreateFunction:cluster=>{
   const children=cluster.getAllChildMarkers(),p={}
   // markercluster shows its top level when the map's minimum zoom drops after creation; an empty group must stay invisible.
   if(!children.length)return L.divIcon({className:'cluster-empty',html:'',iconSize:[0,0]})
   for(const marker of children){const row=marker.options.record;for(const key of ['confirmed_cases','suspected_cases','nws_predictions','registered_animals','evaluations','ranches'])p[key]=(p[key]||0)+amount(row[key])}
   const tone=inventory?'inventory':surveillanceTone(p),size=children.length>=20?64:children.length>=6?58:52
   const unit=inventory?'sin evaluar':municipal?'municipios':'ranchos'
   const title=inventory?`${children.length} municipios con ${number(p.ranches)} ranchos registrados sin evaluaciones · ${number(p.registered_animals)} bovinos registrados`:`${children.length} ${municipal?'municipios':'ranchos'} · ${number(p.evaluations)} evaluaciones · ${number(p.registered_animals)} bovinos registrados`
   return L.divIcon({className:`bovine-cluster marker-cluster tone-${tone}`,html:`<div style="--size:${size}px" title="${escapeHtml(title)}" data-evaluations="${p.evaluations}"><span class="cluster-core">${svg('farm')}<strong>${children.length}</strong><small>${unit}</small></span><span class="cluster-herd">${svg('cow')}<b>${number(p.registered_animals)}</b></span></div>`,iconSize:[size+16,size+26],iconAnchor:[(size+16)/2,(size+16)/2]})
  }})
  const apply=()=>group.eachLayer(layer=>layer.getElement?.()?.classList.toggle('pin-selected',String(layer.options.featureId)===String(selectedRef.current)))
  group.on('animationend spiderfied',apply);map.on('zoomend',apply)
  withIntegerMinZoom(group);map.addLayer(group);groupRef.current=group
  return()=>{map.off('zoomend',apply);group.eachLayer(layer=>{layer.unbindTooltip();layer.off()});group.clearLayers();group.off();map.removeLayer(group);groupRef.current=null;markersRef.current=new Map()}
 },[map,municipal,variant])
 useEffect(()=>{
  const group=groupRef.current;if(!group)return
  const previous=markersRef.current,next=new Map(),added=[],changed=[]
  for(const f of featuresRef.current){
   if(f.geometry?.type!=='Point'||!booleanPointInPolygon(f.geometry.coordinates,state.features[0]))continue
   const id=String(f.id),view=markerView(f,variant,municipal),latLng=[f.geometry.coordinates[1],f.geometry.coordinates[0]]
   const key=JSON.stringify([latLng,view.html,view.tooltip,view.tone]),record={...f.properties,id:f.id,kind:view.kind}
   const entry=previous.get(id)
   if(entry){
    previous.delete(id);entry.marker.options.record=record
    if(entry.key!==key){
     const position=entry.marker.getLatLng();if(position.lat!==latLng[0]||position.lng!==latLng[1])entry.marker.setLatLng(latLng)
     entry.marker.setIcon(pinIcon(view,String(selectedRef.current)===id));entry.marker.setTooltipContent(view.tooltip)
     entry.marker.options.title=view.name;entry.marker.options.alt=view.name;entry.marker.getElement?.()?.setAttribute('title',view.name)
     changed.push(entry.marker)
    }
    next.set(id,{marker:entry.marker,key})
   }else{
    const marker=L.marker(latLng,{record,featureId:f.id,title:view.name,alt:view.name,keyboard:true,riseOnHover:true,zIndexOffset:variant==='inventory'?-400:0,icon:pinIcon(view,String(selectedRef.current)===id)})
    marker.on('click',()=>selectRef.current(marker.options.record))
    marker.bindTooltip(view.tooltip,{direction:'top',offset:[0,-46],className:'livestock-tooltip'})
    added.push(marker);next.set(id,{marker,key})
   }
  }
  const removed=[...previous.values()].map(entry=>entry.marker)
  if(removed.length){removed.forEach(marker=>{marker.unbindTooltip();marker.off()});group.removeLayers(removed)}
  if(added.length)group.addLayers(added)
  if(changed.length)group.refreshClusters(changed)
  markersRef.current=next
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[signature,state,municipal,variant])
 useEffect(()=>{groupRef.current?.eachLayer(layer=>layer.getElement?.()?.classList.toggle('pin-selected',String(layer.options.featureId)===String(selected)))},[selected])
 return null
}

function Metric({icon='cow',value,label,tone}){return <div className={'territory-value '+(tone?'value-'+tone:'')}><Icon name={icon}/><strong>{number(value)}</strong><span>{label}</span></div>}

function Overview({snapshot,authorized,onMunicipality}){
 const top=(snapshot?.municipalities||[]).filter(row=>row.code!=='UNLOCATED'&&amount(row.evaluations)>0).sort((a,b)=>amount(b.evaluations)-amount(a.evaluations)).slice(0,6)
 const maximum=Math.max(1,...top.map(row=>amount(row.evaluations)))
 return <aside className="territory-panel" aria-label="Información territorial">
  <span className="territory-eyebrow">LECTURA DEL TERRITORIO</span>
  <h3>Selecciona un municipio o un marcador</h3>
  <p>Consulta bovinos registrados, evaluaciones y estados sanitarios del periodo. El mapa conserva el contexto de todo Guerrero.</p>
  {top.length>0&&<div className="panel-ranking"><span className="panel-subtitle">Municipios con más evaluaciones</span><ol>{top.map(row=><li key={row.code}><button type="button" className={'tone-'+surveillanceTone(row)} onClick={()=>onMunicipality(row.code)}><span>{row.name}</span><strong>{number(row.evaluations)}</strong><i style={{width:`${100*amount(row.evaluations)/maximum}%`}}/></button></li>)}</ol></div>}
  <div className="territory-privacy"><Icon name="shield"/><span>{authorized?'Solo ves ubicaciones de tu cuenta o con autorización veterinaria.':'Vista pública por municipio. Los marcadores representan municipios, nunca direcciones particulares.'}</span></div>
  <small>Sin registros, no hay marcadores ni alertas de ejemplo.</small>
  <div className="panel-source">Geografía oficial INEGI · Calles y localidades de OpenStreetMap</div>
 </aside>
}

function DetailPanel({record,selectedMunicipality,geography,snapshot,authorized,onHistory,onMunicipality,onClose}){
 const municipality=geography.municipalities.features.find(f=>f.properties.code===selectedMunicipality)
 const row=record||(municipality?{...snapshot?.municipalities?.find(m=>m.code===selectedMunicipality),municipality_name:municipality.properties.name,kind:'municipality'}:null)
 if(!row)return <Overview snapshot={snapshot} authorized={authorized} onMunicipality={onMunicipality}/>
 if(row.kind==='inventory')return <aside className="territory-panel detail-panel tone-inventory" aria-label="Inventario sin evaluaciones">
  <div className="panel-head"><span className="territory-eyebrow">INVENTARIO SIN EVALUACIONES</span><button type="button" className="panel-close" aria-label="Cerrar detalle" onClick={onClose}><Icon name="close"/></button></div>
  <div className="panel-title"><div className="panel-title-icon tone-inventory"><Icon name="farm"/></div><div><h3>{row.municipality_name}</h3><p className="panel-location"><Icon name="location"/>Guerrero · referencia municipal</p></div></div>
  <div className="surveillance-status tone-inventory"><Icon name="farm"/>Ranchos registrados sin evaluaciones en el periodo</div>
  <div className="registered-herd"><Icon name="cow"/><strong>{number(row.registered_animals)}</strong><span>bovinos registrados</span></div>
  <dl className="territory-case-list"><div><dt>{authorized?'Ranchos autorizados sin evaluar':'Ranchos registrados sin evaluar'}</dt><dd>{number(row.ranches)}</dd></div><div><dt>Evaluaciones sanitarias del periodo</dt><dd>0</dd></div></dl>
  <p className="territory-note">Inventario activo registrado desde Android, separado de las evaluaciones del periodo. El símbolo es un punto representativo del municipio INEGI; no indica la ubicación de ningún rancho.</p>
 </aside>
 const tone=surveillanceTone(row),ranch=row.kind==='ranch'
 return <aside className={'territory-panel detail-panel tone-'+tone} aria-label={ranch?'Detalle del rancho':'Detalle municipal'}>
  <div className="panel-head"><span className="territory-eyebrow">{ranch?'RANCHO AUTORIZADO':'AGREGADO MUNICIPAL'}</span><button type="button" className="panel-close" aria-label="Cerrar detalle" onClick={onClose}><Icon name="close"/></button></div>
  <div className="panel-title"><div className={'panel-title-icon tone-'+tone}><Icon name="farm"/></div><div><h3>{ranch?row.ranch_name:row.municipality_name}</h3><p className="panel-location"><Icon name="location"/>{ranch?`${row.municipality_name||'Municipio sin registrar'}, Guerrero`:'Guerrero · referencia municipal'}</p></div></div>
  <div className={'surveillance-status tone-'+tone}><Icon name={tones[tone].icon}/>{tones[tone].label}</div>
  {!ranch&&<p className="aggregate-explanation">{number(row.ranches)} ranchos con evaluaciones sanitarias del periodo. El símbolo es un punto representativo del polígono oficial, no la dirección de un rancho.</p>}
  <div className="registered-herd"><Icon name="cow"/><strong>{number(row.registered_animals)}</strong><span>bovinos registrados</span></div>
  <div className="territory-detail-grid"><Metric value={row.animals} label="bovinos evaluados"/><Metric value={row.nws_animals} label="bovinos con evaluación compatible" tone="visual"/><Metric value={row.suspected_animals} label="bovinos con sospecha profesional" tone="suspected"/><Metric icon="shield" value={row.confirmed_animals} label="bovinos con diagnóstico confirmado" tone="confirmed"/></div>
  <dl className="territory-case-list"><div><dt>Evaluaciones sanitarias válidas</dt><dd>{number(row.evaluations)}</dd></div><div><dt>Casos sospechosos</dt><dd>{number(row.suspected_cases)}</dd></div><div><dt>Diagnósticos confirmados</dt><dd>{number(row.confirmed_cases)}</dd></div><div><dt>Casos en seguimiento</dt><dd>{number(row.follow_up_cases)}</dd></div><div><dt>Bovinos en seguimiento</dt><dd>{number(row.follow_up_animals)}</dd></div></dl>
  <span className="sr-only">{number(row.evaluations)} evaluaciones sanitarias válidas</span>
  {ranch&&row.last_evaluation_at&&<p className="last-evaluation"><Icon name="history"/>Última evaluación: {new Date(row.last_evaluation_at.endsWith('Z')?row.last_evaluation_at:row.last_evaluation_at+'Z').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'})}</p>}
  {ranch&&onHistory&&<button className="territory-history" onClick={()=>onHistory(row.ranch_id)}><Icon name="history"/>Consultar evaluaciones</button>}
  <p className="territory-note">{ranch?'Los bovinos están asociados al rancho; no son posiciones GPS individuales.':'El agregado no identifica propietarios ni ubicaciones particulares.'} Una predicción visual no es un diagnóstico.</p>
 </aside>
}

/** Municipal inventory: registered ranches with no valid evaluation in the period, never a ranch location. */
function inventoryRows(inventory){
 if(!inventory?.rows)return []
 if(inventory.kind==='public')return inventory.rows.filter(row=>row.code!=='UNLOCATED'&&amount(row.registered_ranches)>0&&amount(row.evaluations)===0).map(row=>({code:row.code,name:row.name,ranches:amount(row.registered_ranches),registered_animals:amount(row.registered_animals)}))
 const byMunicipality=new Map()
 for(const row of inventory.rows){
  if(!row.municipality_code||amount(row.evaluations)>0||row.active===false)continue
  const entry=byMunicipality.get(row.municipality_code)||{code:row.municipality_code,name:row.municipality_name,ranches:0,registered_animals:0}
  entry.ranches++;entry.registered_animals+=amount(row.registered_animals);byMunicipality.set(row.municipality_code,entry)
 }
 return [...byMunicipality.values()]
}

export default function OperationalMap({geography,snapshot,inventory,selectedMunicipality,onMunicipality,authorized=false,busy=false,onHistory}){
 const mapSnapshot=snapshot?.territorial||snapshot
 const [map,setMap]=useState(null),[zoom,setZoom]=useState(7),[selected,setSelected]=useState(null),[tilesUnavailable,setTilesUnavailable]=useState(false),[streets,setStreets]=useState(true)
 const geo=geography?.state,municipalities=geography?.municipalities
 const bounds=useMemo(()=>geo?L.geoJSON(geo).getBounds():null,[geo])
 const anchors=useMemo(()=>{const cache=new Map();return code=>{if(!cache.has(code)){const polygon=municipalities?.features.find(f=>f.properties.code===code);cache.set(code,polygon?pointOnFeature(polygon).geometry:null)}return cache.get(code)}},[municipalities])
 const features=useMemo(()=>{
  if(authorized)return mapSnapshot?.map?.features||[]
  if(!municipalities||!mapSnapshot)return []
  const minimum=Math.max(1,Number(mapSnapshot.publicMarkerMinimumRanches)||1)
  return (mapSnapshot.municipalities||[]).filter(row=>row.code!=='UNLOCATED'&&amount(row.ranches)>=minimum&&amount(row.evaluations)>0).flatMap(row=>{
   const geometry=anchors(row.code);if(!geometry)return []
   return [{type:'Feature',id:row.code,geometry,properties:{...row,municipality:row.code,municipality_name:row.name}}]
  })
 },[authorized,mapSnapshot,municipalities,anchors])
 const inventoryFeatures=useMemo(()=>{
  if(!municipalities)return []
  return inventoryRows(inventory).flatMap(row=>{const geometry=anchors(row.code);return geometry?[{type:'Feature',id:`inv-${row.code}`,geometry,properties:{...row,municipality:row.code,municipality_name:row.name}}]:[]})
 },[inventory,municipalities,anchors])
 const totals=useMemo(()=>new Map((mapSnapshot?.municipalities||[]).map(row=>[row.code,row])),[mapSnapshot])
 // Only an explicit municipal choice clears the marker selection; automatic refreshes keep it.
 useEffect(()=>setSelected(null),[selectedMunicipality])
 // The open detail always reads the freshest counts for the selected id; it closes only if the record is gone.
 const record=useMemo(()=>{
  if(!selected)return null
  const feature=[...features,...inventoryFeatures].find(f=>String(f.id)===String(selected.id))
  if(!feature)return null
  return {...feature.properties,id:feature.id,kind:selected.kind}
 },[selected,features,inventoryFeatures])
 const handlers=useRef({});handlers.current={select:record=>setSelected({id:record.id,kind:record.kind}),municipality:code=>onMunicipality(code)}
 const [selectMarker]=useState(()=>record=>handlers.current.select(record))
 const [selectMunicipality]=useState(()=>code=>handlers.current.municipality(code))
 if(!geo||!municipalities||!bounds)return <div className="map-placeholder" role="status"><span className="map-placeholder-pulse"/>Cargando cartografía oficial de Guerrero…</div>
 const summary=mapSnapshot?.summary,proximity=zoom>=10
 return <div className={'operative-map-shell surveillance-map'+(busy?' is-busy':'')}>
  <div className="territory-heading"><div><span className="territory-eyebrow">VIGILANCIA SANITARIA BOVINA</span><h3>Guerrero, 85 municipios</h3><p>{authorized?'Ubicaciones autorizadas y seguimiento por rancho.':'Información municipal agregada. Las ubicaciones privadas están protegidas.'}</p></div><span className={'territory-live '+(busy?'is-loading':'')}><i/>{busy?'Consultando registros':'Datos del periodo'}</span></div>
  <div className="territory-ribbon"><Metric icon="farm" value={summary?.ranches} label="ranchos evaluados"/><Metric value={summary?.registered_animals} label="bovinos registrados en esos ranchos"/><Metric value={summary?.animals} label="bovinos evaluados sanitariamente"/><Metric icon="shield" value={summary?.confirmed_cases} label="diagnósticos veterinarios" tone="confirmed"/></div>
  <div className="operative-map-toolbar"><span><Icon name="location"/>Guerrero · {authorized?'ubicaciones autorizadas':'agregados por municipio'}<small>{proximity?'Vista de proximidad':'Vista territorial'}</small></span><div><button type="button" aria-pressed={streets} onClick={()=>setStreets(v=>!v)}><Icon name="layers"/>{streets?'Ocultar calles':'Mostrar calles'}</button><button type="button" onClick={()=>{setSelected(null);if(map){settle(map);map.flyToBounds(bounds,{padding:STATE_PADDING,duration:.6,animate:!reducedMotion()})}}}><Icon name="reset"/>Restablecer vista completa</button></div></div>
  <div className={'territory-workspace '+(proximity?'proximity-view':'overview-view')}>
   <div className="territory-map-stage">
    <MapContainer ref={setMap} bounds={bounds} boundsOptions={{padding:STATE_PADDING}} maxBounds={bounds.pad(.04)} maxBoundsViscosity={1} maxZoom={18} zoomSnap={.25} zoomDelta={.5} wheelPxPerZoomLevel={120} wheelDebounceTime={60} scrollWheelZoom touchZoom dragging inertia={false} worldCopyJump={false} fadeAnimation markerZoomAnimation className="operative-map" attributionControl={false}>
     {streets&&<TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} bounds={bounds.pad(.04)} eventHandlers={{tileerror:()=>setTilesUnavailable(true)}} noWrap keepBuffer={2} updateWhenIdle={false} updateWhenZooming={false} className="osm-tiles"/>}
     <Director bounds={bounds} selected={selectedMunicipality} municipalities={municipalities} onZoom={setZoom}/>
     <MunicipalityLayer municipalities={municipalities} totals={totals} selected={selectedMunicipality} zoom={proximity?10:7} onSelect={selectMunicipality}/>
     <StateMask state={geo}/>
     <StateOutline state={geo}/>
     <RanchMarkers features={inventoryFeatures} state={geo} onSelect={selectMarker} selected={record?.id} municipal variant="inventory"/>
     <RanchMarkers features={features} state={geo} onSelect={selectMarker} selected={record?.id} municipal={!authorized}/>
    </MapContainer>
    <span className="territory-level"><Icon name={authorized?'farm':'shield'}/>{authorized?'Ranchos autorizados':'Agregados municipales'}</span>
    {busy&&<span className="map-loading" role="status"><i/>Consultando registros…</span>}
    <div className="territory-compass" aria-hidden="true">N<span>↑</span></div>
   </div>
   <DetailPanel record={record} selectedMunicipality={selectedMunicipality} geography={geography} snapshot={mapSnapshot} authorized={authorized} onHistory={onHistory} onMunicipality={selectMunicipality} onClose={()=>{if(record)setSelected(null);else if(selectedMunicipality)onMunicipality(selectedMunicipality)}}/>
  </div>
  <div className="territory-legend" aria-label="Simbología de vigilancia"><span className="legend-title">Simbología</span><span><Icon name="farm"/>{authorized?'Rancho':'Agregado municipal'}</span><span><Icon name="cow"/>Bovinos registrados</span><span className="tone-visual"><i className="legend-swatch"/>Compatibilidad visual (IA)</span><span className="tone-suspected"><i className="legend-swatch"/>Sospecha profesional</span><span className="tone-confirmed"><i className="legend-swatch"/>Diagnóstico confirmado</span><span className="tone-registered"><i className="legend-swatch"/>Con evaluaciones, sin alertas</span><span className="tone-inventory"><i className="legend-swatch"/>Ranchos registrados sin evaluaciones</span><span><i className="empty-area"/>Sin evaluaciones</span></div>
  {tilesUnavailable&&<p className="tile-status" role="status">Algunas calles no pudieron cargarse. Los límites oficiales y los registros siguen disponibles.</p>}
  {!busy&&snapshot&&amount(summary?.evaluations)===0&&inventoryFeatures.length===0&&<div className="map-empty" role="status"><Icon name="farm"/><div><strong>Actualmente no hay evaluaciones registradas para el periodo seleccionado.</strong><span>Los ranchos y las alertas aparecerán cuando existan evaluaciones sanitarias válidas y ubicaciones autorizadas.</span></div></div>}
  {authorized&&amount(snapshot?.unlocatedRanches)>0&&<p className="territory-unlocated">{snapshot.unlocatedRanches} ranchos evaluados sin coordenadas válidas dentro de Guerrero: sus evaluaciones sí se cuentan en los indicadores, pero no se les asigna una ubicación aproximada. Registra la ubicación del rancho en Android para verlo en el mapa.</p>}
  <details className="territory-method"><summary>Cómo leer los símbolos y las cantidades</summary><p>El color del municipio y del marcador indica el estado más relevante registrado en el periodo: ámbar para predicciones del modelo compatibles con miasis, naranja para sospecha profesional y rojo para diagnóstico veterinario confirmado. Describen registros, no zonas de infestación ni prevalencia.</p><p>La cifra con la vaca indica bovinos registrados en los ranchos representados. Al acercarte aparecen los grupos de bovinos únicos por estado; un mismo bovino puede estar en varios estados y esas cifras no deben sumarse. Las agrupaciones cuentan ranchos o municipios, nunca posiciones individuales de bovinos.</p><p>Los agregados públicos se ubican en un punto representativo calculado con point-on-feature sobre el municipio INEGI; no es una ubicación de rancho. No se dibujan límites regionales sin una fuente verificada.</p></details>
  <p className="map-attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> · Marco Geoestadístico INEGI · 85 municipios</p>
 </div>
}
