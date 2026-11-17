# Mapa de vigilancia bovina

OperationalMap.jsx recupera el concepto visual de establos y cantidades del componente TerritoryMap.jsx histórico (commit 38f612c), conservando únicamente sus ideas de diseño. No importa sus datasets, zonas inventadas ni coordenadas ilustrativas.

## Fuente y privacidad

- Estado y 85 municipios oficiales: public/geo/guerrero-catalog.json, con fuentes INEGI y huellas. Carreteras y localidades: mosaicos HTTPS de OpenStreetMap, atribución visible, caché normal, sin precarga masiva.
- Ranchos privados: map.features de /api/observatory/authorized, validados contra el contorno de Guerrero y los permisos del servidor.
- Público: agregados municipales sin nombres ni coordenadas particulares. Los símbolos públicos representan exclusivamente municipios. Punto representativo calculado por Turf point-on-feature sobre el municipio oficial; nunca representa una dirección de rancho.
- No se representan ranchos sin coordenadas como si tuvieran una ubicación aproximada. El mapa representa ranchos con evaluaciones sanitarias del periodo, no un censo completo de ranchos sin evaluaciones.

## Lectura gráfica

Establo: rancho o agregado municipal (identificado con M). Burbuja con bovino: número de animales registrados en esos ranchos. Debajo del establo aparecen hasta dos siluetas por grupo y una cifra total: ámbar para bovinos con evaluación compatible, naranja para bovinos con sospecha profesional y rojo/escudo para confirmados por veterinario. Son animales únicos por grupo, no fotografías ni puntos GPS. Un animal puede pertenecer a varios grupos; no sumarlos.

El panel complementa los símbolos con cantidades, fecha real de última evaluación y acceso al historial autorizado. Las agrupaciones cuentan ranchos o municipios y se expanden al acercarse. El panel se coloca debajo en pantallas pequeñas.

## Selección y filtros

La selección municipal conserva los colores de otros municipios: solo cambia el contorno resaltado y la cámara. El backend aporta territorial con el mismo periodo y filtros, retirando exclusivamente el filtro municipal. Tarjetas y gráficas mantienen el filtro elegido; el mapa conserva contexto geográfico. Fecha, mes, región, categoría y seguimiento sí actualizan los colores territoriales.

La clasificación pública contiene tres categorías sanitarias. Los errores borran datos operativos de la consulta y permiten reintento; nunca se activan mocks. Una base sin evaluaciones válidas produce cero y ningún marcador.

## Cartografía y recorte

Máscara SVG del tamaño del visor, recalculada al mover, ampliar y redimensionar. No utiliza un polígono mundial de coordenadas gigantes. Geometrías de Guerrero y Acatepec comprobadas como válidas. El borde estatal permanece definido, los límites municipales discretos y los rellenos no atenúan las calles innecesariamente. No se inventan límites regionales sin datos verificados.

## Pruebas

Playwright cubre datos vacíos, marcadores privados, bovinos y sus estados, agregados públicos, filtros, conservación de colores, Acatepec, agrupaciones y móvil. Los datos controlados solo existen en tests; las capturas se guardan en verification ignorado. Las pruebas normales interceptan únicamente imágenes de mosaicos para evitar sobrecargar OSM; BOVISAFE_LIVE_TILES=1 activa una comprobación puntual del proveedor real. BOVISAFE_E2E_FIXTURE habilita la prueba privada de integración HTTP/fotografía, sin publicar credenciales.
