# Portal conectado de BoviSafe

La entrada principal muestra el observatorio p�blico agregado y un acceso privado a evaluaciones del backend. Permite consultar historial por bovino, foto protegida, seis puntuaciones, versión, recomendaciones, observaciones, próxima revisión y auditoría veterinaria. El propietario guarda seguimiento; los controles profesionales solo aparecen en registros asignados por el servidor. Los permisos se vuelven a validar en cada petición.

La demostración territorial anterior sigue disponible mediante un botón explícito y conserva sus avisos de datos ficticios. No se mezclan sus cifras con los registros del portal.

## Ejecutar

`npm.cmd ci` y `npm.cmd run dev`. Vite redirige `/api` al backend local en `127.0.0.1:8080`. Para otro servidor, definir VITE_API_URL con la URL de su API (incluyendo `/api`) y configurar en ese servidor los orígenes permitidos o un proxy del mismo origen. La compilación no publica el sitio.

`npm.cmd run build` genera `dist`. `npm.cmd test` ejecuta Playwright con Chrome instalado, sin ventana. Las pruebas de navegador verifican login, historial, distinción entre predicción y diagnóstico, edición de observaciones, cierre de sesión y errores del servidor mediante contratos HTTP controlados. El backend tiene las pruebas HTTP contra PostgreSQL real.

La sesión se conserva únicamente en memoria de la pestaña; recargar requiere iniciar sesión. Los tokens se envían en cabeceras, nunca en enlaces de imágenes. El portal no expone ranchos ni fotografías a usuarios anónimos.
