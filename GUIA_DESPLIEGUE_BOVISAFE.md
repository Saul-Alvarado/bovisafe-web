# Guía de despliegue BoviSafe

Preparada el 17 de noviembre de 2026. Este documento no crea servicios, no activa facturación y no acredita pruebas en infraestructura pública. Los valores entre `<...>` son marcadores que debe sustituir el propietario. No copiar contraseñas al chat, Git, React ni al APK.

## 0. Condiciones previas

- Resolver SEGURIDAD_ROTACION.md del backend. La contraseña PostgreSQL histórica sigue aceptándose localmente y SMTP no tiene revocación comprobada. No conectar Render a la rama main contaminada.
- Publicar el snapshot limpio como master solo después de confirmar la rotación. Revisar el hash remoto y mantener auto-deploy desactivado.
- Elegir cuentas y regiones compatibles. Confirmar las condiciones y límites vigentes antes de aceptar una activación que pueda generar gastos.
- Ejecutar pruebas locales. Cámara, galería, modo avión y recepción GPS requieren además recorrido manual en el teléfono; las pruebas de controles opcionales no verifican la precisión GPS.

## 1. Neon: PostgreSQL

1. Cuando se autorice el despliegue, crear un proyecto PostgreSQL y una base de BoviSafe. Conservar en un gestor de secretos el host, base, rol y contraseña nuevos que genere Neon. No reutilizar contraseñas históricas.
2. Usar conexión TLS con verificación de identidad. En Render configurar `DATABASE_JDBC_URL=jdbc:postgresql://<host-neon>/<base>?sslmode=verify-full&channelBinding=require`; usuario y contraseña van en variables separadas. Comprobar que la CA de Neon sea confiable para la JVM del contenedor. No desactivar la verificación si aparece un error de certificado.
3. Para migraciones, usar el endpoint directo y un rol propietario del esquema. Abrir psql con contraseña solicitada interactivamente y CA confiable:

```text
psql "host=<host-neon> dbname=<base> user=<rol-migraciones> sslmode=verify-full sslrootcert=<ruta-CA-confiable>" -W
```

4. Comprobar primero si existe el esquema:

```sql
SELECT to_regnamespace('bovisafe');
SELECT ssl,version,cipher FROM pg_stat_ssl WHERE pid=pg_backend_pid();
```

5. Solo si la base está vacía, desde la raíz del backend ejecutar en esa sesión:

```text
\set ON_ERROR_STOP on
\i db/baseline/schema-v005.sql
\i db/migrations/006_operational_observatory.sql
\i db/verify-schema.sql
```

El baseline contiene la estructura completa hasta 005, sin datos ni propietarios. **No ejecutar 001–005 otra vez encima del baseline.** En una base existente no cargarlo: revisar columnas e índices, respaldar y aplicar únicamente los scripts pendientes en orden. 006 ya está aplicada en desarrollo. No hay un ejecutor automático de migraciones; Spring usa `ddl-auto=validate` y no debe cambiarse a create/update para ocultar un error.

6. Para producción separar el rol de migraciones del rol de aplicación. Conceder a la aplicación CONNECT en su base, USAGE en bovisafe, SELECT/INSERT/UPDATE/DELETE en las tablas necesarias y USAGE/SELECT en secuencias. Configurar privilegios por defecto para tablas futuras desde el rol propietario. No otorgar superusuario.
7. `GeographyService` carga/upserta el catálogo oficial municipal al iniciar; la cuenta de aplicación necesita los permisos correspondientes. Ejecutar `db/verify-schema.sql`: ninguna columna debe resultar FALLIDA. Verificar claves foráneas y unicidad de request_key. Confirmar 85 municipios después del primer inicio.
8. Si se transfieren datos locales reales, hacerlo mediante un plan de copia privado, con respaldo y verificación. No cargar fixtures TEST para llenar el observatorio ni subir dumps a Git. Las consultas sanitarias comienzan el 1 de noviembre de 2026; la historia anterior se conserva.

## 2. Almacenamiento privado y persistente

Alternativa a evaluar: Cloudflare R2 Standard, compatible con S3; confirmar sus requisitos de cuenta, tarifas y límites antes de activarlo. AWS S3 u otro proveedor S3 compatible también pueden utilizarse con la configuración existente. Ninguno está contratado ni probado remotamente.

1. Crear un bucket exclusivo, sin acceso público, sin dominio público y sin r2.dev habilitado. Elegir ubicación y política de conservación adecuadas para fotografías privadas.
2. Crear credenciales limitadas al bucket y a lectura/escritura/borrado de objetos necesarios para la aplicación; no utilizar una clave administrativa global. Guardarlas únicamente en Render.
3. Variables: `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_PATH_STYLE`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. En R2 usar la región `auto` y el endpoint HTTPS S3 que entregue la cuenta; comprobar path-style según proveedor. En AWS S3 usar la región real y dejar endpoint vacío para el endpoint AWS estándar. El valor predeterminado de render.yaml no sustituye la región elegida.
4. No se necesita CORS público del bucket: React y Android descargan por la API autenticada. El backend comprueba propietario o asignación veterinaria antes de leer el objeto.
5. Si se migran fotografías existentes, conservar claves como `cattle/<id>/<uuid>.<ext>`, verificar SHA-256 y conservar los originales hasta terminar. No copiarlas al repositorio.
6. Probar: subir desde Android, consultar foto con usuario autorizado, comprobar 401/404 para accesos indebidos, reiniciar/republicar Render y recuperar de nuevo la foto. Confirmar que el objeto no sea accesible mediante URL pública. Estas pruebas remotas están pendientes.

## 3. Render: Spring Boot

1. Importar BoviSafe-back, seleccionando la futura rama master limpia. Elegir Web Service con Docker, Dockerfile en la raíz. No importar main histórica ni activar despliegues automáticos. `render.yaml` mantiene `autoDeployTrigger: off`.
2. El Dockerfile compila con Java 17 y ejecuta como usuario sin privilegios. La construcción Docker omite pruebas porque necesitan PostgreSQL local; la publicación exige haber ejecutado previamente `mvnw.cmd clean package` con las pruebas locales. Docker no se ejecutó en este entorno.
3. Configurar secretos desde el panel de Render:

| Variable | Valor esperado |
|---|---|
| SPRING_PROFILES_ACTIVE | prod |
| DATABASE_JDBC_URL | JDBC Neon con verify-full y channelBinding=require |
| DATABASE_USERNAME / DATABASE_PASSWORD | Rol de aplicación nuevo y contraseña exclusiva |
| DB_POOL_SIZE | 5 inicialmente; ajustar a límites de Neon |
| BOVISAFE_CORS_ORIGINS | Origen HTTPS exacto de Vercel; varios separados por comas, sin comodines |
| S3_BUCKET / S3_REGION / S3_ENDPOINT / S3_PATH_STYLE | Configuración privada del proveedor elegido |
| AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY | Credenciales restringidas al bucket |
| SMTP_HOST / SMTP_PORT / SMTP_USERNAME / SMTP_PASSWORD / SMTP_AUTH | Proveedor real y credencial ya rotada, si se habilita recuperación por correo |

4. Render suministra PORT; Spring escucha en `0.0.0.0:${PORT}`. Configurar health check `/api/health`, que no muestra credenciales. No fijar un puerto distinto en el código.
5. Ejecutar el despliegue manual solamente cuando se autorice. Anotar la URL HTTPS real asignada; no se ha creado ninguna URL Render para este proyecto.
6. Verificar logs sin credenciales, ausencia de errores de esquema/TLS/S3 y health check. `prod` desactiva SQL y trazas de error públicas. Si falta una tabla, aplicar la migración pendiente de forma controlada; no reinicializar la base.
7. Autenticación actual: tokens opacos aleatorios, hash SHA-256 en PostgreSQL, caducidad de doce horas. **No es JWT** y no requiere inventar JWT_SECRET. Comprobar login, expiración, permisos y persistencia de sesiones tras reinicio.
8. Probar preflight y solicitudes reales desde el origen Vercel exacto. Agregar un origen Preview solo si se necesita y se autoriza. No utilizar `*` con datos privados.

## 4. Vercel: React + Vite

1. Importar bovisafe-web en la rama master verificada, framework Vite. Instalación `npm ci`, build `npm run build`, salida `dist` y raíz del repositorio.
2. Configurar `BOVISAFE_API_URL=<URL-HTTPS-real-Render>/api`. La función `api/config.js` entrega esa URL mediante `/runtime-config`, con no-store y sin secretos. `VITE_API_URL` solo es alternativa de compilación.
3. `vercel.json` configura `/runtime-config` y fallback SPA, manteniendo recursos `/api`, `/assets` y `/geo`. Los despliegues Git automáticos están desactivados; un despliegue manual posterior requiere autorización. GitHub Pages ya no publica la antigua demostración.
4. Cambiar de backend actualizando la variable en Vercel y aplicando la configuración a un despliegue manual; no editar React. Actualizar el CORS de Render con el origen Vercel real.
5. Verificar `/runtime-config`, carga de `/geo/guerrero-catalog.json`, rutas SPA, login, fotografías protegidas, cierre de sesión y error visible cuando la API falla. La sesión vive en memoria, por lo que recargar requiere iniciar sesión.
6. Con cero evaluaciones sanitarias válidas, el observatorio debe mostrar cero y ningún marcador. Las categorías públicas son solo tres. Probar fechas, mes, región, municipio, clasificación y seguimiento. Los puntos precisos solo aparecen con autorización.
7. OpenStreetMap aporta calles y localidades reales; INEGI aporta Guerrero y sus 85 municipios. Mantener atribución visible, Referer de navegador, HTTPS y caché normal. No descargar mapas masivos ni ofrecer precarga offline de mosaicos OSM. El servicio público no tiene SLA; evaluar proveedor alternativo para tráfico sostenido. Los fixtures de imágenes cartográficas solo están en tests; una prueba opt-in comprueba OSM real.

## 5. Android: API pública y APK

1. Para desarrollo en emulador, usar `http://10.0.2.2:8080/`. Para teléfono físico usar la IPv4 LAN real de la PC en la misma red. `localhost` del teléfono no es la PC. La pantalla Configurar servidor permite cambiar la URL sin editar código y separa colas por servidor y cuenta.
2. Para una compilación de prueba contra Render, desde el proyecto Android:

```powershell
.\gradlew.bat "-PbovisafeApiUrl=<URL-HTTPS-real-Render>/" assembleDebug
.\gradlew.bat "-PbovisafeApiUrl=<URL-HTTPS-real-Render>/" assembleRelease
```

También puede definirse BOVISAFE_API_URL en el entorno. Release exige HTTPS. `app/build/outputs/apk/debug/app-debug.apk` es el APK instalable de prueba; release requiere firma privada antes de distribuir. No subir APK, keystore ni contraseñas a Git.

3. Instalar con `adb install -r app/build/outputs/apk/debug/app-debug.apk`. Mantener la variante `.e2e` aislada de la aplicación del productor.
4. Registrar/iniciar sesión, registrar rancho con y sin coordenadas y bovino. GPS es opcional y requiere confirmación; la posición del teléfono no se acepta automáticamente como ubicación del rancho.
5. Probar manualmente cámara y galería. Activar modo avión después de guardar el contexto del bovino, ejecutar inferencia local, cerrar y reabrir la app, comprobar SQLite y actividad reciente. No se necesita ubicación para la inferencia.
6. Recuperar conexión, iniciar sesión si expiró y sincronizar con Render. Reintentar sin duplicar request_key. Verificar en React foto y seis puntuaciones. Un arranque lento de Render conserva el pendiente en SQLite.
7. Comprobar que ENVIRONMENT, POOR_QUALITY y OCCLUSION aparezcan como Análisis no evaluable y pidan repetir la captura; no deben aumentar las estadísticas sanitarias. No convertir NWS en diagnóstico ni cerrar seguimientos por HEALTHY.

## 6. Restricciones a comprobar antes de publicar

- Render Free suspende servicios tras inactividad y usa disco efímero; no guardar fotos en el filesystem del contenedor. Su documentación desaconseja Free para producción. Un piloto gratuito puede tener latencia de arranque y límites de horas, compilación, RAM y transferencia.
- Neon Free tiene cuotas de cómputo, almacenamiento y transferencia, y suspensión de cómputo según configuración. Revisar las cifras vigentes del panel y las condiciones de recuperación/respaldos; no asumir alta disponibilidad o recuperación ilimitada.
- Vercel Hobby se orienta a uso personal no comercial y tiene límites. Confirmar que el uso previsto de BoviSafe sea admisible antes de elegirlo; no asumir gratuidad para operación comercial.
- R2 tiene cupos gratuitos y cobra al superarlos; confirmar requisitos de facturación y controles de gasto. No habilitar servicios si el requisito sigue siendo gasto cero y la cuenta no puede garantizarlo.
- OSM público ofrece disponibilidad best-effort. El mapa base puede fallar sin afectar datos sanitarios ni límites oficiales. No reemplazar datos del backend por mocks.

Fuentes oficiales consultadas para esta guía:
- https://render.com/docs/free
- https://neon.com/docs/introduction/plans
- https://vercel.com/docs/plans/hobby
- https://developers.cloudflare.com/r2/pricing/
- https://operations.osmfoundation.org/policies/tiles/

## 7. Aceptación del piloto

Solo dar por desplegado después de comprobar TLS, CORS, persistencia tras reinicio, bucket privado, autorización entre dos cuentas, migraciones, inferencia offline y sincronización Android → PostgreSQL → React. Registrar hashes publicados y resultados reales. No trasladar datos personales ni coordenadas privadas a un entorno de prueba público. Conservar las limitaciones del modelo experimental y la orientación a atención veterinaria y notificación al SENASICA.
