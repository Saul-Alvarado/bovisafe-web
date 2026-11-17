# Verificación final local — noviembre de 2026

| Comprobación | Estado | Evidencia ejecutada |
|---|---|---|
| Android debug/release y prueba unitaria | APROBADO | Gradle BUILD SUCCESSFUL; testE2eUnitTest |
| Samsung físico, variante aislada E2E | APROBADO | 6 pruebas instrumentadas: inferencia real, SQLite, HTTP, migración y reintento |
| Spring Boot | APROBADO | clean package; 37 pruebas, cero fallos/errores |
| React producción | APROBADO | vite build y prueba de URL dinámica |
| Navegador | APROBADO | 11 pruebas, incluidos escenarios A–F y consulta HTTP/foto real |
| Observatorio sin datos operativos | APROBADO | API real devuelve cero; TEST excluidos sin eliminar registros |
| Cámara, galería, modo avión y GPS manuales | NO VERIFICADO | Requieren recorrido manual de interfaz en teléfono |
| Límites regionales digitales | NO VERIFICADO | Se conservan Guerrero y 85 municipios oficiales INEGI; selector de ocho regiones declaradas, sin inventar polígonos regionales |
| Infraestructura pública y Docker | NO VERIFICADO | No se desplegó; Docker no disponible |
| Push backend | FALLIDO | Bloqueado por contraseñas históricas PostgreSQL/SMTP pendientes de rotación |

El observatorio consulta desde 2026-11-01 (zona America/Mexico_City). No elimina historia. Las cifras proceden de SQL y distinguen evaluaciones, bovinos, predicciones, sospechas profesionales, diagnósticos y casos únicos. Una evaluación HEALTHY no cierra un caso. Datos TEST y SIMULATED nunca alimentan el observatorio.

El mapa operativo no importa mocks. Los fixtures están exclusivamente en tests. Un fallo de API informa el error y mantiene la cartografía sin inventar registros. La vista pública ofrece agregados municipales; los puntos y nombres precisos requieren autorización. Los colores indican conteos registrados, no estimaciones epidemiológicas. No se dibujan límites regionales no verificados.

Las pruebas PostgreSQL controladas se revierten por transacción. La migración 006 preserva los registros y añade procedencia/auditoría, casos y catálogo municipal. No repetir scripts aplicados. Las credenciales reales, fotografías y pruebas locales permanecen ignoradas.

Preparación de despliegue: React vercel.json y API de configuración en tiempo de ejecución; backend Dockerfile, render.yaml sin despliegue automático, perfil prod, variables Neon/SSL y S3 privado; Android API configurable por propiedad de compilación y pantalla de servidor, HTTPS en release. Consultar DESPLIEGUE.md de cada proyecto. No se crearon servicios.

Antes del despliegue: rotar las credenciales históricas del backend, configurar secretos externos y bucket privado, verificar CORS/HTTPS y ejecutar cámara/galería/modo avión/GPS manualmente. La autorización para push no autoriza el despliegue automático.
