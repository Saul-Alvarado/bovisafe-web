import { useEffect, useRef, useState } from 'react'
import { MapContainer, GeoJSON, Polygon, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'

function Boundaries({ bounds, selected, municipalities }) {
 const map=useMap()
 useEffect(()=>{
  function resize(){const min=map.getBoundsZoom(bounds,false,L.point(28,28));map.setMinZoom(Math.floor(min));if(map.getZoom()<min)map.fitBounds(bounds,{padding:[14,14],animate:false});map.panInsideBounds(bounds,{animate:false})}
  const observer=new ResizeObserver(()=>{map.invalidateSize({pan:false});resize()});observer.observe(map.getContainer());resize()
  const update=()=>{const el=map.getContainer();el.dataset.zoom=String(map.getZoom());el.dataset.center=JSON.stringify([map.getCenter().lat,map.getCenter().lng])}
  map.on('moveend zoomend resize',update);update()
  return()=>{observer.disconnect();map.off('moveend zoomend resize',update)}
 },[map,bounds])
 useEffect(()=>{if(selected){const feature=municipalities.features.find(f=>f.properties.code===selected);if(feature)map.fitBounds(L.geoJSON(feature).getBounds(),{padding:[22,22],maxZoom:10,animate:false})}},[map,selected,municipalities])
 return null
}
function Markers({ features, state }) {
 const map=useMap()
 useEffect(()=>{
  const group=L.markerClusterGroup({maxClusterRadius:45,showCoverageOnHover:false,spiderfyOnMaxZoom:true,removeOutsideVisibleBounds:true})
  for(const f of features){
   if(f.geometry?.type!=='Point'||!booleanPointInPolygon(f.geometry.coordinates,state.features[0]))continue
   const p=f.properties,confirmed=Number(p.confirmed_cases)>0,suspected=Number(p.suspected_cases)>0,nws=Number(p.nws_predictions)>0
   const tone=confirmed?'confirmed':suspected?'suspected':nws?'visual':'registered'
   const marker=L.marker([f.geometry.coordinates[1],f.geometry.coordinates[0]],{icon:L.divIcon({className:'operational-marker marker-'+tone,html:'<span aria-hidden="true"></span>',iconSize:[18,18]}),title:p.ranch_name})
   const body=document.createElement('div'),title=document.createElement('strong');title.textContent=p.ranch_name;body.append(title)
   for(const [key,label] of [['evaluations','evaluaciones'],['animals','bovinos evaluados'],['nws_predictions','predicciones NWS'],['suspected_cases','casos sospechosos'],['confirmed_cases','casos confirmados'],['follow_up_cases','casos en seguimiento']]){const line=document.createElement('p');line.textContent=String(p[key]||0)+' '+label;body.append(line)}
   marker.bindPopup(body);group.addLayer(marker)
  }
  map.addLayer(group);return()=>map.removeLayer(group)
 },[map,features,state]);return null
}
export default function OperationalMap({ geography, snapshot, selectedMunicipality, onMunicipality, authorized=false, busy=false }) {
 const [map,setMap]=useState(null)
 const geo=geography?.state,municipalities=geography?.municipalities
 const boundsRef=useRef(null)
 if(geo&&!boundsRef.current)boundsRef.current=L.geoJSON(geo).getBounds()
 if(!geo||!municipalities)return <div className="map-placeholder" role="status">Cargando cartografía oficial de Guerrero…</div>
 const bounds=boundsRef.current
 const totals=new Map((snapshot?.municipalities||[]).map(m=>[m.code,m]))
 const rings=(geo.features[0].geometry.type==='MultiPolygon'?geo.features[0].geometry.coordinates: [geo.features[0].geometry.coordinates]).map(poly=>poly[0].map(([x,y])=>[y,x]))
 const features=authorized?snapshot?.map?.features||[]:[]
 function style(f){const p=totals.get(f.properties.code);return {color:f.properties.code===selectedMunicipality?'#173f35':'#a8beb2',weight:f.properties.code===selectedMunicipality?2.2:.7,fillColor:Number(p?.confirmed_cases)>0?'#b34b42':Number(p?.suspected_cases)>0?'#c88534':Number(p?.nws_predictions)>0?'#d7af66':Number(p?.evaluations)>0?'#86b49a':'#eef4ed',fillOpacity:.85}}
 return <div className="operative-map-shell">
  <div className="operative-map-toolbar"><span>Guerrero · {authorized?'ubicaciones autorizadas':'agregados por municipio'}</span><button type="button" onClick={()=>map?.fitBounds(bounds,{padding:[14,14],animate:true})}>Restablecer vista completa</button></div>
  <MapContainer ref={setMap} bounds={bounds} boundsOptions={{padding:[14,14]}} maxBounds={bounds.pad(.015)} maxBoundsViscosity={1} maxZoom={12} zoomSnap={.25} zoomDelta={.5} wheelPxPerZoomLevel={140} scrollWheelZoom touchZoom dragging inertia={false} worldCopyJump={false} className="operative-map" attributionControl={false}>
   <Boundaries bounds={bounds} selected={selectedMunicipality} municipalities={municipalities}/>
   <GeoJSON key={selectedMunicipality+'-'+JSON.stringify(snapshot?.municipalities)} data={municipalities} style={style} onEachFeature={(feature,layer)=>{
    layer.on('click',()=>onMunicipality(feature.properties.code))
    const label=document.createElement('span');label.textContent=feature.properties.name;layer.bindTooltip(label,{sticky:true,direction:'top',className:'municipality-tooltip'})
   }}/>
   <Polygon positions={[[[84,-179],[84,179],[-84,179],[-84,-179],[84,-179]],...rings]} pathOptions={{stroke:false,fillColor:'#f5f7f1',fillOpacity:1,fillRule:'evenodd',interactive:false}} interactive={false}/>
   <GeoJSON data={geo} style={{color:'#416e59',weight:1.6,fill:false,interactive:false}} interactive={false}/>
   <Markers features={features} state={geo}/>
  </MapContainer>
  {busy&&<span className="map-loading" role="status">Consultando registros…</span>}
  <p className="map-attribution">INEGI · Marco Geoestadístico · 85 municipios. Zoom con rueda o pellizco, arrastre limitado a Guerrero. Sin mosaicos externos.</p>
  {!busy&&snapshot&&Number(snapshot.summary.evaluations)===0&&<div className="map-empty" role="status"><strong>Actualmente no hay evaluaciones registradas para el periodo seleccionado.</strong><span>Los ranchos y las alertas aparecerán cuando existan registros con ubicaciones autorizadas.</span></div>}
  {authorized&&Number(snapshot?.unlocatedRanches)>0&&<p>{snapshot.unlocatedRanches} ranchos evaluados sin coordenadas válidas dentro de Guerrero. No se les asigna una ubicación aproximada.</p>}
  <div className="map-legend"><span><i className="legend-zero"/>Sin evaluaciones</span><span><i className="legend-registered"/>Evaluaciones registradas</span><span><i className="legend-visual"/>Compatibilidad visual NWS</span><span><i className="legend-suspected"/>Sospecha profesional</span><span><i className="legend-confirmed"/>Confirmación profesional</span></div>
 </div>
}
