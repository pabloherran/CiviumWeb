# CIVIUM · Portal web de gestión municipal

Portal web pensado para que los **administradores municipales** (rol
`MUNICIPAL_ADMIN`) y **superadministradores** (`SUPER_ADMIN`) gestionen las
incidencias urbanas desde una oficina, sin depender de la app Android: ver el
listado completo, filtrarlo, consultar el mapa de incidencias abiertas y
administrar operarios/invitaciones. Consume el mismo backend Ktor que ya usa
la app móvil (`IncidenciasBakcend`, desplegado en `https://api.civium.app/`).

## Stack

- **React 19 + TypeScript**, compilado con **Vite**.
- **react-router-dom** para el enrutado (SPA).
- **axios** como cliente HTTP, con interceptor que añade el JWT y gestiona el
  401 (expulsa a `/login` si el token caduca).
- **@react-google-maps/api** para el mapa (Google Maps JavaScript API, la
  misma familia de proveedor que usa la app Android con Maps SDK).
- Sin framework de CSS: estilos propios en `src/index.css`, deliberadamente
  ligeros para no añadir dependencias innecesarias en un panel interno.

¿Por qué este stack y no Next.js o Compose Multiplatform? Es un panel de
administración interno, sin necesidad de SEO ni renderizado en servidor —
una SPA con Vite es más simple de desplegar y mantener. Compose for Web se
descartó porque su ecosistema de mapas/tablas para web es todavía inmaduro
comparado con React.

## Puesta en marcha

```bash
npm install
cp .env.example .env   # y rellena las variables (ver abajo)
npm run dev
```

### Variables de entorno (`.env`)

| Variable | Descripción |
| --- | --- |
| `VITE_API_BASE_URL` | URL base del backend. Debe terminar en `/`. Por defecto `https://api.civium.app/`. |
| `VITE_GOOGLE_MAPS_API_KEY` | API key de Google Maps JavaScript API, restringida por dominio en Google Cloud Console. Puede vivir en el mismo proyecto de GCP que ya usa la app Android (`MAPS_API_KEY`) o ser una key nueva restringida a este dominio. |

Sin `VITE_GOOGLE_MAPS_API_KEY` la app funciona igualmente (login, listado,
detalle, usuarios); solo la pantalla de mapa mostrará un aviso.

## Autenticación

Reutiliza el endpoint existente `POST /auth/login`. El portal **rechaza en
el propio cliente** los logins de usuarios con rol `CITIZEN` u `OPERATOR`
(el backend no distingue "apps" — es el mismo login que usa la app móvil),
mostrando un mensaje claro en vez de dejarles entrar a un panel que no les
corresponde. El JWT se guarda en `localStorage` y se adjunta automáticamente
en cada petición.

## Estructura

```
src/
  api/          # llamadas HTTP (auth, incidencias, admin, municipios)
  types/        # tipos calcados de los DTOs del backend
  context/      # AuthContext (sesión, login/logout)
  routes/       # ProtectedRoute
  components/   # Layout (sidebar), StatusBadge, ...
  pages/        # LoginPage, IncidentsListPage, IncidentDetailPage,
                # IncidentsMapPage, UsersPage
```

## Funcionalidades (MVP actual)

- **Login** restringido a administradores.
- **Listado de incidencias** (`GET /incidencias`) con filtro por estado,
  categoría y (para `SUPER_ADMIN`) municipio.
- **Detalle de incidencia**: descripción, fotos, ubicación, y gestión de
  estado (marcar como resuelta con nota obligatoria / reabrir), reutilizando
  `PATCH /incidencias/{id}/status`.
- **Mapa de incidencias abiertas** (Google Maps) con marcador por incidencia
  y acceso rápido al detalle.
- **Gestión de usuarios**: listado de operarios/administradores
  (`GET /admin/users`), activar/desactivar cuentas, y gestión de
  invitaciones (crear, listar, revocar) sobre `/admin/invitations`, reglas
  de alcance ya aplicadas por el backend (un `MUNICIPAL_ADMIN` solo ve/crea
  para su municipio; un `SUPER_ADMIN` puede elegir municipio y rol).

## Roadmap: reparto de incidencias a operarios

Todavía **no está implementado**, ni aquí ni en el backend ni en la app
Android — se ha dejado preparado para una fase futura:

- El tipo `Incident` (`src/types/incident.ts`) ya incluye los campos
  opcionales `assignedTo` / `assignedToName`, comentados como "no enviados
  aún por el backend", para no tener que retocar el modelo cuando se
  implemente.
- La página de detalle de incidencia tiene una sección "Asignación de
  trabajo" visible pero deshabilitada, explicando que está planificada.

Para implementarlo de verdad hará falta, como mínimo:

1. Backend: añadir `assignedTo: String?` (id de operario) al modelo
   `Incident` y a `IncidentDto`, más un endpoint (p. ej.
   `PATCH /incidencias/{id}/assign`) que solo pueda usar un `MUNICIPAL_ADMIN`
   sobre operarios de su propio municipio.
2. Portal web: UI para elegir operario desde la ficha de la incidencia y
   para ver la carga de trabajo por operario.
3. App Android: mostrar al operario las incidencias que se le han asignado
   (hoy `IncidentListScreen`/`IncidentsMapScreen` no filtran por
   asignación).

## Despliegue

Es una SPA estática (`npm run build` genera `dist/`), así que puede
desplegarse en cualquier hosting de estáticos con HTTPS. Ahora mismo se usa
Railway como solución rápida; la recomendación a largo plazo, cuando el
proyecto pase a producción real, es migrar a **Firebase Hosting**.

Subdominio sugerido: `admin.civium.app` (`civium.app` y `api.civium.app` ya
están ocupados). Se puede cambiar sin coste, es solo un registro DNS.

### Corto plazo: Railway

El repo ya trae `railway.json` y un script `npm start` (sirve `dist/` con
[`serve`](https://www.npmjs.com/package/serve)) para que Railway lo despliegue
sin configuración adicional:

1. En Railway, "New Project" → "Deploy from GitHub repo" → selecciona este
   repositorio.
2. En las variables del servicio, añade `VITE_API_BASE_URL` y
   `VITE_GOOGLE_MAPS_API_KEY`. **Importante**: al ser Vite, estas variables se
   incrustan en el build, así que deben estar disponibles como *build
   variables*, no solo en runtime.
3. Railway detecta Node automáticamente (Nixpacks) y usa `npm run build` +
   `npm run start` gracias a `railway.json`.
4. En "Settings → Networking → Custom Domain", añade `admin.civium.app` y
   crea el registro CNAME que te indique en el proveedor DNS de `civium.app`.
5. Añade ese dominio a las restricciones HTTP referrer de la API key de
   Google Maps (ver más arriba).

### Largo plazo (recomendado): Firebase Hosting

La app Android y el backend ya usan Firebase (Cloud Messaging, Admin SDK) y
Google Cloud Storage, así que el portal encaja en el mismo proyecto de GCP
sin añadir un proveedor ni una facturación nuevos. Comparado con las
alternativas:

- **Firebase Hosting** (recomendado): gratuito hasta 10 GB almacenados y
  360 MB/día de transferencia (de sobra para un panel interno), CDN global,
  certificado SSL gestionado automáticamente, dominio propio en minutos,
  cero mantenimiento de servidor (100% estático), y una GitHub Action
  oficial para desplegar en cada push. Mismo proyecto de GCP que ya usáis.
- Cloud Run + Nginx: más control, pero añade un contenedor y facturación por
  cómputo para servir lo que en el fondo son ficheros estáticos — carga
  operativa innecesaria aquí.
- Cloud Storage + Load Balancer + Cloud CDN: la opción "enterprise" de GCP,
  pero el Load Balancer tiene un coste fijo mensual (~18 $) incluso con
  tráfico mínimo — desproporcionado para un panel de administración interno.
- Vercel/Netlify: excelente experiencia de desarrollo, pero es un proveedor
  y una facturación aparte del resto de la infraestructura de Civium (GCP).

El repo ya trae preparado lo necesario para cuando llegue el momento de
migrar:

- `firebase.json`: configuración de Hosting (sirve `dist/`, redirección de
  rutas de la SPA a `index.html`, cache agresiva de los assets con hash).
- `.firebaserc.example`: renómbralo a `.firebaserc` y sustituye el
  `project_id` por el de vuestro proyecto de Firebase (o genera el archivo
  automáticamente con `firebase init hosting`, reutilizando el `firebase.json`
  que ya existe).
- `.github/workflows/deploy-firebase.yml`: despliegue automático por GitHub
  Actions en cada push a `main`. Desactivado por defecto (solo manual) hasta
  que configuréis los secrets `FIREBASE_SERVICE_ACCOUNT`,
  `VITE_API_BASE_URL` y `VITE_GOOGLE_MAPS_API_KEY` en el repo — instrucciones
  dentro del propio archivo.

Pasos para migrar cuando llegue el momento:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # elige "use an existing project", el mismo de Firebase/Android
npm run build
firebase deploy
```

Después, en la consola de Firebase Hosting: "Add custom domain" →
`admin.civium.app` → sigue las instrucciones de verificación y el registro
DNS que te indique. Firebase emite y renueva el certificado SSL solo.

### En cualquier caso

El backend ya tiene `anyHost()` en CORS, así que acepta peticiones desde
cualquier dominio — no hace falta tocar nada ahí al cambiar de hosting.
Cuando el portal esté en un dominio fijo de producción, merece la pena
restringir `anyHost()` a los dominios reales (el del portal, y `localhost`
para desarrollo) en vez de aceptar cualquier origen; es una mejora de
seguridad razonable una vez todo esté estable, no algo urgente ahora mismo.

## Repositorio

Este proyecto vive en su propio repositorio (independiente de
`IncidenciasAndroidApp` e `IncidenciasBakcend`), ya que es una base de
código distinta (frontend web) con su propio ciclo de despliegue.
