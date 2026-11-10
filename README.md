# BoviSafe · Observatorio territorial (maqueta React)

Prototipo visual **público** del dashboard de BoviSafe, sin conexión al backend. Mapa de Guerrero, zonas ilustrativas de color, ranchos con marcadores, alertas simuladas y estadísticas interactivas.

## Requisitos

- macOS y Terminal.
- Node.js 20.19+ o 22.12+ (se recomienda instalar una versión LTS compatible).
- npm (incluido en Node.js).

Comprueba con `node -v` y `npm -v`.

## Ejecutar

```bash
cd bovisafe-web
npm install
npm run dev
```

Abre en el navegador la URL que indique Vite (por defecto `http://localhost:5173`).

**No se necesita Angular, Python, PostgreSQL, Spring Boot ni una API para ejecutar este prototipo.**

```bash
npm run build
npm run preview
```

## Estructura

```text
bovisafe-web/
├── index.html                  Entrada HTML
├── package.json                Dependencias y scripts
├── vite.config.js              Vite + React
├── src/
│   ├── main.jsx                Montaje React
│   ├── App.jsx                 Dashboard, filtros y gráficas
│   ├── components/
│   │   └── TerritoryMap.jsx    Leaflet, geozonas, pins y navegación
│   ├── data/
│   │   ├── mockData.js         Ranchos y animales ficticios
│   │   ├── guerrero-contorno.json
│   │   └── zonas-ilustrativas.json
│   └── styles/
│       └── main.css            Diseño responsive
├── public/geo/                 Copias GeoJSON para inspección
└── scripts/generate_geo.py     Script de generación de zona demo (OPCIONAL)
```

## Cómo probar

1. Cambiar el modo de coloreado entre **Alertas** y **Zonas**.
2. Hacer clic en un rancho sobre el mapa para ver su resumen.
3. Seleccionar un rancho desde el listado para centrar el mapa y ver su desglose de riesgos.
4. Filtrar ranchos con o sin alertas; buscar por nombre o municipio.
5. Seleccionar un área ilustrativa del mapa o una tarjeta de zona para restringir el área analizada.
6. Usar **Restablecer vista** y las herramientas +, − y recentrar.
7. Descargar CSV de datos ficticios mediante **Exportar CSV demo**.

## Seguridad de la información y semántica

- **No hay animales realmente diagnosticados o infectados aquí.** `alto` y `critico` representan una **alerta de riesgo simulada**, no una infección confirmada ni un caso oficial.
- Cada bovino de prueba tiene una evaluación actual. Para datos reales, contar solo la **evaluación más reciente** de cada animal por rango temporal definido, y registrar historia aparte.
- Los ranchos, sus nombres, posiciones y cifras son ficticios. En producción, los datos de ranchos deben tratarse como privados. Un panel público debe limitar la precisión geográfica o requerir consentimiento explícito, agregando datos por municipio/zona y aplicando supresión de celdas con pocos ranchos.
- El mapa utiliza un **contorno geográfico simplificado de Guerrero**, y **ocho celdas Voronoi de demostración con nombres orientativos**. **No representa con precisión las ocho regiones político-administrativas del estado.** Para la versión real, reemplazar `zonas-ilustrativas.json` por geometrías regionales verificadas y documentar la fuente.
- Esta demo **no usa API, autenticación, sincronización ni base de datos**.

## Fuente del contorno y licencias

El contorno geográfico simplificado se derivó de la entidad Guerrero del archivo `mexicoHigh.json` de `angelnmara/geojson` (github.com/angelnmara/geojson), proyecto de cartografía GeoJSON de México. Verifica licencia y procedencia antes de publicar comercialmente. `scripts/generate_geo.py` permite reproducir nuestras celdas demo a partir del contorno simplificado embebido (requiere Python + shapely; **no se ejecuta para usar React**).

Para polígonos administrativos de producción, considera una fuente oficial vigente (INEGI / CONABIO / Gobierno de Guerrero) y documenta su edición, fecha y precisión.

## Futuro enlace con Spring Boot

Sustituir `src/data/mockData.js` por servicio REST que consulte ranchos, bovinos y **su última evaluación** con controles de privacidad. Mantener la interfaz como presentación; no poner tokens secretos ni credenciales en el frontend. El backend debe devolver métricas agregadas para público, nunca datos sensibles de ganaderos o coordenadas exactas sin autorización.


## Mapa base (sin API key)

El portal ahora usa las teselas estándar de OpenStreetMap: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`. No se necesita cuenta ni clave para probar localmente. **Requiere conexión a Internet** para mostrar las calles y etiquetas; la silueta y las zonas demostrativas se cargan desde archivos del proyecto.

Se mantiene visible la atribución `© OpenStreetMap contributors`. Por favor no la ocultes. Para un sitio público de alto tráfico o con SLA, elige un proveedor de teselas administrado, revisa sus condiciones y cuotas. No hagas descargas masivas ni precargas de los servidores comunitarios. Política: https://operations.osmfoundation.org/policies/tiles/

### Si aún aparece la marca de CARTO

Detén Vite (`Control+C`), inicia de nuevo (`npm run dev`) y fuerza recarga en el navegador (`Cmd+Shift+R`). Comprueba que `src/components/TerritoryMap.jsx` ya no contiene `basemaps.cartocdn.com`.

## Versión 3: mapa limitado a Guerrero e historial simulado

- **Solo Guerrero visible:** capa GeoJSON invertida y opaca oculta visualmente el mapa exterior al estado, incluso al aumentar el zoom. El lienzo exterior queda en verde grisáceo, sin nombres ni carreteras de estados vecinos. El nivel mínimo de zoom se calcula con el espacio disponible para no alejarse más que el territorio completo, y `maxBoundsViscosity=1` limita el desplazamiento. No se necesitan claves externas.
- **Colores suaves:** riesgo por zona de baja saturación; mapa base OpenStreetMap visible a través de las regiones.
- **Filtro de fechas:** `Vista actual`, `Por mes` (junio–noviembre de 2026), `Rango de meses` (por ejemplo octubre–noviembre). Todas las tarjetas, ranchos y colores del mapa usan la misma selección temporal.
- **Significado de un rango:** cada bovino se cuenta **una sola vez**, usando el mayor nivel de riesgo de las evaluaciones ficticias que caen dentro del intervalo. No significa infección confirmada, ni que siga actualmente con ese riesgo.
- **Serie histórica:** gráfica de bovinos con alto/crítico por mes que permite comparar el comportamiento mensual y resalta los meses seleccionados. Se aplica el filtro por zona en la gráfica.
- **Datos ficticios:** este ejemplo genera un registro de prueba por bovino y por mes; no crea datos persistidos ni consulta el backend. El módulo `src/data/history.js` contiene la simulación y debe sustituirse al conectar la API.
- **Limitación cartográfica:** el contorno es simplificado y las ocho divisiones internas son ilustrativas, no regiones o municipios oficiales. Para producción deberá usarse cartografía oficial verificada.
- **Privacidad:** la demo muestra coordenadas inventadas. No publicar ubicación exacta de ganaderos sin autorización.

Para probar: entra a `Mapa territorial`, cambia entre `Vista actual` y `Por mes` (por ejemplo julio) y después elige `Rango de meses` octubre–noviembre. Observa cómo cambian las cifras, el mapa y el gráfico. Los botones de simular nuevas alertas solo están disponibles en la vista actual.
