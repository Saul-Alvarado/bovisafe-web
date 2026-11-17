# Preparación de Vercel — sin despliegue ejecutado

`vercel.json` configura Vite, `npm run build`, salida `dist` y `/runtime-config` hacia la función `api/config.js`. No se hizo push ni se llamó a herramientas de despliegue.

Definir `BOVISAFE_API_URL=https://<servicio-render>/api` en Vercel. La función lee la variable al ejecutar y entrega únicamente la URL pública, con Cache-Control no-store. Cambiar la URL requiere actualizar la variable y aplicar la configuración de despliegue de Vercel; no requiere editar el código React. `VITE_API_URL` permanece como alternativa de compilación. La URL de producción debe ser HTTPS y no contener credenciales.

El backend debe configurar `BOVISAFE_CORS_ORIGINS=https://<proyecto-vercel>` con el origen exacto. Nunca colocar credenciales de Neon, S3 ni SMTP en variables VITE o en esta función. Los tokens de usuario viven en memoria de la pestaña y las fotos se solicitan con Authorization, no mediante URLs públicas.

Localmente, `npm.cmd run dev` usa `/api` con proxy a `127.0.0.1:8080`. `BOVISAFE_PROXY_TARGET` permite modificar el proxy sin editar código; `BOVISAFE_API_URL` permite probar un origen explícito y sus reglas CORS. `npm.cmd run build` genera el sitio sin publicarlo.

Pruebas:

```powershell
npm.cmd run test:config
$env:BOVISAFE_E2E_FIXTURE='C:/Users/saula/AndroidStudioProjects/BoviSafe/verification/e2e-private.json'
npm.cmd test
```

Dos pruebas de navegador usan contratos controlados. `tests/live-e2e.spec.js` usa el backend y PostgreSQL reales y las credenciales locales de una cuenta de verificación creada desde Android. Sin ese archivo, esa prueba se marca omitida; no se informa como aprobada. Las credenciales no están en Git. La prueba real valida que las seis puntuaciones y la foto de Android se muestran y que las observaciones se persisten.

El observatorio operativo solo usa GeoJSON de `GET /api/territory/ranches`, con permisos de propietario o veterinario. El contorno es una referencia cartográfica; no se crean puntos aproximados para ranchos sin coordenadas. La demostración original queda identificada y separada de estos datos.

La conexión pública Vercel–Render, TLS y CORS de los dominios finales están pendientes de credenciales y autorización para publicar. Referencias: https://vercel.com/docs/frameworks/frontend/vite y https://vercel.com/docs/environment-variables.
