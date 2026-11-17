# Observatorio operativo BoviSafe

La página inicial consulta /api/observatory. No importa demostraciones ni activa datos ficticios cuando la API está vacía o falla. Los archivos históricos de demostración solo permanecen en tests/fixtures/legacy, fuera del build.

Las consultas comienzan el 1 de noviembre de 2026 y excluyen registros TEST y análisis SIMULATED. Tarjetas, mapa y gráficas comparten filtros de fecha, mes, municipio, región declarada, clasificación y seguimiento. Las barras permiten filtrar; hay tooltips, carga, error, reintento y restablecimiento.

Cartografía: límites estatales y 85 municipios INEGI, con fuentes y huellas en public/geo/guerrero-catalog.json. No se inventan polígonos regionales: la Sierra comprende partes de municipios y el selector utiliza la región declarada del rancho. La vista pública contiene agregados municipales; nombres, puntos precisos, historial y fotografías requieren autorización del backend.

Ejecutar npm.cmd ci y npm.cmd run dev. Vite dirige /api al backend local. npm.cmd run build genera dist. npm.cmd test ejecuta Playwright con Chrome; npm.cmd run test:config comprueba la URL dinámica. La prueba live-e2e requiere BOVISAFE_E2E_FIXTURE apuntando al archivo privado generado por el teléfono; no se publica ese archivo.

Las once pruebas de navegador pasaron, incluidos escenarios A–F, agrupación de 25 marcadores y fotografía autenticada contra el backend real. La sesión permanece en memoria y los tokens se envían en cabeceras.

Consultar DESPLIEGUE.md para Vercel y configuración de URL sin editar código. Los despliegues automáticos están desactivados. No se creó infraestructura pública.
