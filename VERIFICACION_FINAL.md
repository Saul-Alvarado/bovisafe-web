# Verificación final de ajustes BoviSafe — 17 de noviembre de 2026

| Comprobación ejecutada | Estado | Resultado |
|---|---|---|
| Android debug y release | APROBADO | Gradle BUILD SUCCESSFUL |
| Pruebas unitarias Android | APROBADO | 3 pruebas, incluidas las seis etiquetas y reglas sanitarias |
| Samsung físico, variante E2E | APROBADO | 9 pruebas: inferencia real, SQLite, HTTP, reintentos, actividad reciente offline, detalle y controles opcionales de ubicación |
| Spring Boot clean package | APROBADO | 42 pruebas, cero fallos/errores |
| PostgreSQL | APROBADO | Mismo esquema 006; sin nuevas migraciones ni borrado de historia; fixtures de integración revertidos |
| React producción y configuración dinámica | APROBADO | Build Vite y prueba de URL sin editar código |
| Pruebas de navegador | APROBADO | 18 pruebas, cero fallos; Escenarios del mapa, seis etiquetas privadas/tres sanitarias públicas, API real, privacidad, fotografía y OSM opt-in |
| Cámara, galería, modo avión y recepción GPS manual | NO VERIFICADO | No se ejecutó el recorrido manual; el teléfono se retiró después de las nueve pruebas |
| Despliegue y bucket S3 remoto | NO VERIFICADO | Sin recursos creados ni gastos; Docker no disponible aquí |
| Publicación backend | BLOQUEADA | Credencial PostgreSQL histórica aún aceptada y revocación SMTP no comprobada |

Solo NWS, HEALTHY y LESION alimentan las estadísticas sanitarias. ENVIRONMENT, POOR_QUALITY y OCCLUSION permanecen en el historial como análisis no evaluables. Nunca crean casos nuevos, alertas ni bovinos evaluados sanitariamente. Un intento posterior no cierra ni altera un seguimiento previo. La valoración veterinaria no puede confirmar o cerrar un caso utilizando exclusivamente una foto no evaluable.

Las etiquetas y explicaciones están en español; no se modificaron los pesos ni los seis códigos del modelo. La puntuación no se presenta como probabilidad clínica. Se conservan las recomendaciones preventivas y las orientaciones veterinarias y de notificación.

El mapa dibuja establos y siluetas bovinas en las coordenadas autorizadas del rancho. Las cantidades de animales son únicas; varias fotografías no multiplican bovinos. Las siluetas representan asociaciones al rancho, no posiciones GPS individuales. Las cohortes ámbar, naranja y roja distinguen compatibilidad visual, sospecha profesional y confirmación veterinaria. Un bovino puede aparecer en más de un estado: no sumar esos grupos.

La selección municipal modifica el borde y el encuadre, conservando los colores territoriales del periodo en los demás municipios. Las tarjetas y gráficas se filtran por municipio; el contexto territorial conserva los demás filtros. Ambos conjuntos de datos se calculan dentro de la transacción de lectura del backend. La vista pública no recibe coordenadas de ranchos; solo dibuja agregados ilustrados con evaluaciones sanitarias válidas, en puntos representativos calculados desde el municipio INEGI.

La geometría de Acatepec y Guerrero se validó como correcta. Se reemplazó la máscara mundial por una máscara en píxeles del visor, evitando coordenadas SVG mundiales y recortes inestables. No se atribuye un artefacto específico a OSM sin evidencia. Las capturas controladas están en verification y llevan marca de entorno de pruebas; no se incluyen como datos operativos.

Consultar GUIA_DESPLIEGUE_BOVISAFE.md para Neon, Render, almacenamiento privado, Vercel y Android. SEGURIDAD_ROTACION.md del backend indica los pasos de revocación y publicación limpia. El historial antiguo se respalda localmente; ninguna credencial histórica se considera revocada por crear una rama limpia.
