"""Build illustrative Voronoi-style zones clipped to a simplified Guerrero outline.
The outer contour is derived from angelnmara/geojson mexicoHigh.json (Guerrero feature).
The demo zones are NOT official administrative region boundaries.
"""
import json
from pathlib import Path
from shapely.geometry import Polygon, Point, MultiPoint, mapping
from shapely.ops import voronoi_diagram

OUT = Path(__file__).resolve().parents[1] / 'public' / 'geo'
outline = [
[-99.4647,18.6613],[-99.453,18.5734],[-99.3651,18.5646],[-99.2845,18.4627],[-99.0642,18.4361],[-98.9724,18.3472],[-98.9743,18.3004],[-98.8666,18.2318],[-98.8177,18.1458],[-98.6888,18.1443],[-98.7231,18.0859],[-98.555,18.0178],[-98.5502,17.9767],[-98.3791,18.0163],[-98.2506,17.9101],[-98.327,17.7047],[-98.2178,17.4724],[-98.1936,17.2965],[-98.2304,17.2646],[-98.2376,17.1854],[-98.1236,17.1357],[-98.1101,17.0173],[-98.0361,16.9642],[-98.0217,16.9043],[-98.0584,16.7937],[-98.1806,16.7241],[-98.1879,16.6719],[-98.3521,16.5337],[-98.3705,16.4559],[-98.5559,16.3192],[-98.7753,16.555],[-98.9072,16.5342],[-99.3313,16.6574],[-99.6806,16.7043],[-99.8757,16.8134],[-99.8603,16.855],[-99.9144,16.8275],[-99.9941,16.911],[-101.0564,17.2753],[-101.0714,17.3221],[-101.2013,17.427],[-101.4506,17.5279],[-101.4415,17.5603],[-101.4777,17.6018],[-101.6429,17.6695],[-101.6734,17.7419],[-101.7477,17.7927],[-101.8023,17.8825],[-102.0425,17.9897],[-102.1265,17.9516],[-102.1757,17.9902],[-102.1762,18.1622],[-101.8858,18.2699],[-101.8931,18.5376],[-101.8318,18.5656],[-101.8062,18.5424],[-101.7608,18.5912],[-101.7458,18.5676],[-101.6318,18.5834],[-101.5936,18.5164],[-101.5178,18.4825],[-101.2864,18.5356],[-101.0101,18.4941],[-100.9593,18.3994],[-100.8772,18.4366],[-100.6472,18.3086],[-100.6163,18.3472],[-100.7294,18.4917],[-100.7902,18.7729],[-100.7275,18.8443],[-100.6878,18.783],[-100.5531,18.9144],[-100.5096,19.0076],[-100.4197,19.0603],[-100.4076,18.9487],[-100.4497,18.8758],[-100.4791,18.7148],[-100.4642,18.654],[-100.3941,18.625],[-100.3902,18.5796],[-100.4666,18.483],[-100.4497,18.4608],[-100.327,18.4555],[-100.2647,18.3468],[-100.2082,18.3559],[-100.1227,18.4424],[-100.0304,18.4612],[-100.0579,18.5139],[-100.0033,18.5554],[-99.8318,18.5477],[-99.785,18.5859],[-99.7511,18.5748],[-99.7337,18.6342],[-99.6632,18.6463],[-99.6777,18.712],[-99.5299,18.6473],[-99.4647,18.6613]
]
state = Polygon(outline)
assert state.is_valid, 'State contour invalid'
zones = [
    ('costa-grande', 'Costa Grande', (-101.3, 17.55)),
    ('tierra-caliente', 'Tierra Caliente', (-100.9, 18.35)),
    ('sierra', 'Sierra', (-100.5, 17.83)),
    ('norte', 'Norte', (-99.75, 18.48)),
    ('centro', 'Centro', (-99.52, 17.70)),
    ('acapulco', 'Acapulco', (-99.84, 16.93)),
    ('costa-chica', 'Costa Chica', (-98.75, 16.85)),
    ('montana', 'La Montaña', (-98.70, 17.62))
]
seeds = MultiPoint([p for _,_,p in zones])
polys = list(voronoi_diagram(seeds).geoms)
zone_features = []
for zid, name, coords in zones:
    seed = Point(coords)
    hits = [g for g in polys if g.buffer(1e-9).covers(seed)]
    assert len(hits) == 1, (name,len(hits))
    region = hits[0].intersection(state)
    assert region.area > .01, (name,region.area)
    zone_features.append({'type':'Feature','properties':{'id':zid,'nombre':name,'precision':'ilustrativa'},'geometry':mapping(region)})
geo_state = {'type':'FeatureCollection','features':[{'type':'Feature','properties':{'nombre':'Guerrero','fuente':'angelnmara/geojson mexicoHigh.json (simplificado)'},'geometry':mapping(state)}]}
geo_zones = {'type':'FeatureCollection','features':zone_features}
OUT.mkdir(parents=True,exist_ok=True)
(OUT/'guerrero-contorno.geojson').write_text(json.dumps(geo_state,ensure_ascii=False,separators=(',',':')))
(OUT/'zonas-ilustrativas.geojson').write_text(json.dumps(geo_zones,ensure_ascii=False,separators=(',',':')))
print('GeoJSONs created: polygon valid', state.is_valid,'size',state.area,'zones', len(zone_features))
for item in zone_features: print(item['properties']['nombre'],round(Polygon(item['geometry']['coordinates'][0]).area,2) if item['geometry']['type']=='Polygon' else 'MultiPolygon')
