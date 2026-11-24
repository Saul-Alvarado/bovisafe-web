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
