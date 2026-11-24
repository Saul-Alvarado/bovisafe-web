# Reportes CSV y estabilidad del mapa

## Reportes y exportación (`src/components/Reports.jsx`)

- **Reporte municipal (público):** `GET /api/reports/municipalities`. Los 85 municipios INEGI con cero cuando no hay registros, fila "Sin municipio verificado" si existen ranchos sin municipio reconocido y total de Guerrero. Sin nombres de ranchos, propietarios ni coordenadas.
- **Reporte por rancho (privado):** `GET /api/reports/ranches` con `Authorization: Bearer`. El backend devuelve solo ranchos propios o con asignación veterinaria activa, incluidos los ranchos sin evaluaciones. No incluye coordenadas.
- Filtros: desde, hasta, mes, región declarada y municipio. Mismos criterios que el observatorio: registros OPERATIONAL (TEST excluidos), análisis LOCAL_AI, categorías NWS/HEALTHY/LESION, periodo desde 2026-11-01.
- "Bovinos evaluados" = animales únicos; "Evaluaciones" = fotografías analizadas. Una predicción de IA compatible con miasis no es un diagnóstico.
- "Ranchos/bovinos registrados" = registros activos a la fecha de consulta (no dependen del periodo).

### CSV (`src/reports/csv.js`)

UTF-8 con BOM, CRLF, comillas RFC 4180, separador coma (Excel México) o punto y coma (Excel España). Las celdas de texto que empiezan con `= + - @`, tabulador o retorno se prefijan con `'` (protección contra CSV Formula Injection). Se exportan todas las filas filtradas, la fila de totales y notas de periodo y criterios.

## Estabilidad del mapa (`src/components/OperationalMap.jsx`)

- La capa de 85 municipios se crea una sola vez; datos, selección y zoom solo cambian estilos (`setStyle`). La selección usa una capa de resalte separada.
- Los marcadores usan un único grupo de agrupación; una actualización con los mismos datos no recrea marcadores.
- Actualizar la consulta ya no vuelve a descargar la cartografía.
- La máscara exterior tiene un margen y se transforma durante la animación de zoom (sin parpadeos en los bordes).
- Límites rígidos (`maxBoundsViscosity=1`, sin inercia) y `settle()` antes de cada vuelo: un rebote pendiente ya no cancela "Restablecer vista".
- Seleccionar un municipio ya visible no mueve la cámara; quitar la selección regresa a la vista completa de Guerrero.

## Pruebas

```bash
npm run test:unit   # CSV y configuración
npx playwright test # mapa, filtros, reportes, privacidad, móvil
```

## Marcadores, regiones y actualización automática (noviembre 2026)

### Causas encontradas
- **Marcadores aislados invisibles.** El mapa fija un zoom mínimo fraccionario (por ejemplo 8.25) para encuadrar Guerrero. Leaflet.markercluster 1.5.3 crea su rejilla desde `Math.floor(minZoom)`, pero empieza a pintar desde el `minZoom` sin redondear. Por eso se saltaba el nivel superior: un municipio sin vecinos evaluados (en producción, Ometepec) no se dibujaba, mientras que los municipios agrupados sí aparecían. Se corrige con `withIntegerMinZoom`, que se aplica solo a los grupos de BoviSafe. La prueba "every municipality with evaluations is represented" falla sin la corrección.
- **Periodo congelado.** El filtro "Hasta" guardaba la fecha del día en que se abrió la página, y "Actualizar consulta" repetía exactamente esa consulta. Ahora un "Hasta" vacío significa "hoy, en la hora del centro de México" y el servidor lo resuelve en cada consulta.
- **Regiones sin catálogo municipal.** El catálogo traía `regionCode: null` en los 85 municipios, y el servidor filtra solo por la región declarada en el rancho. En producción ningún rancho la declara, así que el filtro dejaba los 85 municipios (o los ponía en cero).
- **Detalle cerrado en cada actualización.** `OperationalMap` reiniciaba la selección cada vez que cambiaba `snapshot`.
- Se verificaron sin hallar fallas: categorías válidas (`NWS`, `HEALTHY` y `LESION`; `ENVIRONMENT`, `POOR_QUALITY` y `OCCLUSION` son fotografías no evaluables), exclusión de TEST, zona horaria (la fecha se guarda en UTC desde el instante de captura) y claves municipales. Riesgo documentado: el backend exige `lower(trim(estado)) = 'guerrero'`, de modo que un rancho registrado en Android con otra escritura del estado (por ejemplo "Gro.") queda fuera. No se modificó por compatibilidad con Android 1.0.0.

### Regiones (`src/territory/regions.js`)
- **Fuente.** Programas Regionales 2022-2027 del Gobierno de Guerrero (SEPLADER), uno por región. La correspondencia se hizo **por nombre**, porque los programas numeran los municipios de 2021 con claves estatales distintas de las del INEGI.
- **Composición.** Acapulco 1, Centro 11, Costa Chica 18, Costa Grande 8, Norte 16, Montaña 19 y Tierra Caliente 9.
- **Sierra** se delimita por localidades (Decreto 240):
  - General Heliodoro Castillo y Leonardo Bravo pertenecen completos a Sierra.
  - Otros 12 municipios son parciales: solo cuentan los ranchos que declararon Sierra.
- **Sin región.** Santa Cruz del Rincón no aparece en ninguna tabla publicada y no se le asigna región.
- **Regla.** Un registro pertenece a la región si su municipio pertenece completo a ella o si el rancho la declaró. Se combinan la respuesta general y la respuesta por región declarada del servidor, sin contar dos veces ninguna fila.
- **Gráficas por mes, clasificación y casos.** No se pueden dividir por región en el cliente, así que cuando hay una región activa se muestran con la etiqueta "Todo Guerrero".

### Reportes
- Región y municipio se aplican en React: la tabla, el número de filas, los totales, el CSV y su nombre de archivo cambian al instante.
- El total se calcula siempre con las filas en pantalla ("Total Costa Chica", "Total Guerrero", etc.).
- El CSV añade estas columnas:
  - "Región (catálogo oficial)".
  - "Región declarada por ranchos".
  - "Pertenencia a la región filtrada", solo cuando hay región activa.
- El CSV añade metadatos de ámbito, filtros y número de filas.
- El selector de municipios muestra solo los de la región elegida.

### Inventario sin evaluaciones
- **Vista pública.** Los municipios con ranchos registrados y sin evaluaciones en el periodo se muestran con un marcador neutro y discontinuo. Los datos salen de `/api/reports/municipalities` y el marcador se coloca en el punto representativo del municipio INEGI.
- **Vista privada.** Lo mismo, solo con los ranchos autorizados (`/api/reports/ranches`). Nunca se inventan coordenadas.

### Actualización automática (`src/live/`)
- **Frecuencia.** Consulta cada 60 s mientras la pestaña está visible y hay conexión. Consulta de inmediato al volver a la pestaña o al recuperar la conexión.
- **Sin solicitudes de más.** No inicia una consulta si la anterior sigue en curso. Al fallar espera progresivamente más (hasta 4× el intervalo). Las consultas idénticas que coinciden en el tiempo se comparten.
- **Cambio de filtros.** Cancela las peticiones obsoletas.
- **Comparación de datos.** Se usa una huella del contenido que ignora `generatedAt`. Si no cambió nada, no hay renderizado ni aviso.
- **Sin recargar la página.** Se conservan mapa, zoom, selección, paneles, filtros y ordenamientos. Los marcadores se actualizan en su lugar (por id) y no se vacían.
- **Errores en segundo plano.** Se conservan los datos y se muestra el estado en el indicador "Actualización automática activa · Última consulta: …".
