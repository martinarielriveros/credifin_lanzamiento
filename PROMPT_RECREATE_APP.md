# Master Prompt & Especificación Técnica Completa: Credifin Routes Visualizer

> Este documento contiene la especificación arquitectónica integral y el **prompt maestro reproducible** para recrear desde cero la aplicación **Credifin Routes Visualizer** (plataforma web interactiva para visualización, trazabilidad vial y gestión logística de rutas de transporte en Argentina).

---

## 📋 Índice
1. [Prompt Maestro para IA (Copy-Paste Ready)](#1-prompt-maestro-para-ia-copy-paste-ready)
2. [Arquitectura del Sistema y Stack Tecnológico](#2-arquitectura-del-sistema-y-stack-tecnológico)
3. [Estructura del Proyecto y Archivos](#3-estructura-del-proyecto-y-archivos)
4. [Esquema de Base de Datos SQLite y Caché Persistente](#4-esquema-de-base-de-datos-sqlite-y-caché-persistente)
5. [Motor de Geocodificación y Verificación Exacta](#5-motor-de-geocodificación-y-verificación-exacta)
6. [Motor de Enrutamiento Vial (OSRM) y Geometrías Reales](#6-motor-de-enrutamiento-vial-osrm-y-geometrías-reales)
7. [Especificación de la API REST (FastAPI)](#7-especificación-de-la-api-rest-fastapi)
8. [Diseño Frontend: Sistema Visual, Mapas y Componentes](#8-diseño-frontend-sistema-visual-mapas-y-componentes)
9. [Formatos de Archivos, Datos de Muestra y CSV Flexible](#9-formatos-de-archivos-datos-de-muestra-y-csv-flexible)

---

## 1. Prompt Maestro para IA (Copy-Paste Ready)

Copia y pega el siguiente bloque en cualquier asistente de IA (Claude 3.7 / Gemini 1.5 Pro / GPT-4o / Antigravity) para regenerar la solución completa:

```markdown
Actúa como un Desarrollador Full-Stack Senior y Arquitecto de Software especialista en SIG (Sistemas de Información Geográfica), interfaces web modernas y backend con Python FastAPI.

Tu objetivo es construir desde cero una aplicación web de nivel producción llamada "Credifin Routes Visualizer". La aplicación permite cargar archivos CSV con rutas de transporte logístico en Argentina, geocodificarlas con precisión exacta (verificando provincia y ciudad), calcular el trazado vial real por carreteras entre nodos con OSRM, almacenar todo en SQLite y desplegar un mapa interactivo con estética Dark Glassmorphism, paneles flotantes, filtros por grupo operativo y explorador de rutas.

### Requisitos Técnicos Mandatorios:
1. **Backend**: Python 3.10+ con FastAPI y Uvicorn. Sin frameworks pesados innecesarios.
   - Bibliotecas: `fastapi`, `uvicorn`, `requests`, `python-multipart`.
   - Persistencia: SQLite nativo (`data/routes.db`) con 3 tablas: `routes`, `geocache`, `route_geometry_cache`.
   - Concurrencia: `ThreadPoolExecutor(max_workers=6)` para cálculo paralelo de trayectorias.
   - Manejo de CSV flexible: Auto-detección de delimitadores (`,`, `;`, `\t`, `|`), limpieza de BOM UTF-8 (`\ufeff`), fallback de codificaciones (`utf-8`, `latin-1`, `cp1252`), y matching flexible de columnas normalizando acentos y mayúsculas (`Grupo`, `Ciudad 1`, `Provincia-Ciudad1`, `Ciudad2`, más soporte opcional de coordenadas directas `lat1`, `lon1`, `lat2`, `lon2`).

2. **Geocodificación Robusta para Argentina**:
   - Catálogo local integrado con más de 80 ciudades y sus respectivas provincias (lat/lon exactos).
   - Normalización de provincias con alias populares (ej: `bs as` -> `buenos aires`, `cba` -> `cordoba`, `sta fe` -> `santa fe`, etc.).
   - Función de validación de combinación exacta `(Provincia-Ciudad1, Ciudad1)` clasificando en: `EXACT_PRESET`, `EXACT_GEOCODED`, `CITY_ONLY`, `PROVINCE_MISMATCH`, `NOT_FOUND`.
   - Fallback a OpenStreetMap Nominatim con User-Agent personalizado y caché persistente en SQLite.

3. **Cálculo de Rutas Viales (Carreteras Reales)**:
   - Integración con el motor público gratuito OSRM (`router.project-osrm.org/route/v1/driving/...`) solicitando `overview=full&geometries=geojson`.
   - Conversión de GeoJSON `[lon, lat]` a formato Leaflet `[lat, lon]`.
   - Caché bidireccional de trayectorias en SQLite: si `A -> B` está en caché, `B -> A` se reutiliza invirtiendo el array de coordenadas.
   - Fallback matemático: Si OSRM no responde, calcular distancia Haversine (+18% de factor vial) y curva Bézier suave para que nunca falle la experiencia visual.

4. **Frontend (Vanilla HTML5, Modern CSS, Leaflet.js, ES6 JavaScript)**:
   - Estética ultra premium Dark Glassmorphism (`backdrop-filter: blur(18px)`, paleta slate/indigo/cyan, tipografías 'Outfit' y 'Plus Jakarta Sans', iconos FontAwesome 6).
   - **Header**: Branding Credifin, contadores estadísticos en tiempo real (Rutas, Grupos, Ciudades, Total Km en píldoras dinámicas) y botones de acción (Subir CSV, Cargar Ejemplo, Descargar Plantilla, Limpiar Base de Datos).
   - **Mapa Leaflet**: 
     - Nodos de ciudad únicos y desduplicados (agrupados por precisión ~11m) con marcador pulsante de neón y badge con el conteo de rutas que pasan por ella.
     - Popup enriquecido por ciudad: lista desglosada con scroll de "Salidas hacia" y "Conexiones de llegada", distancias en km, etiquetas coloreadas por grupo y enlaces clickeables "Ver ruta".
     - Trayectorias viales coloreadas por grupo, efecto hover glow, tooltip vial y **marcador de kilometraje flotante directamente en el punto medio de cada carretera**.
     - Selector de capas base (Dark Gray Canvas de Esri, Calles Esri, OpenStreetMap Estándar, Satelital Esri).
     - Botón ON/OFF para alternar la visibilidad de los badges de distancia en el mapa.
   - **Panel Flotante: Filtro por Grupo**:
     - Búsqueda en vivo de grupos, botón "Todos", checkboxes individuales con color representativo, botón "Solo este" para aislar corredores con un solo clic, y botón "Centrar" (`fitBounds`).
   - **Explorador de Rutas Flotante (Drawer inferior)**:
     - Colapsable, con buscador instantáneo por ciudad o provincia, tarjetas con origen -> destino, kilometraje, coordenadas y acción al hacer clic: enfoca la ruta en el mapa con animación flyTo, resalta la línea y abre el popup de la ciudad origen.
   - **Modal de Carga Drag & Drop**:
     - Drag and drop interactivo de archivos CSV, selector de modo ("Reemplazar rutas existentes" vs "Agregar a las existentes"), feedback visual y validaciones.

5. **Entregables**:
   - Genera el código completo, modular y listo para ejecutar de todos los archivos necesarios:
     - `requirements.txt`
     - `database.py`
     - `services/geocoding.py`
     - `services/routing.py`
     - `main.py`
     - `sample_routes.csv`
     - `static/index.html`
     - `static/css/style.css`
     - `static/js/api.js`
     - `static/js/map.js`
     - `static/js/app.js`
```

---

## 2. Arquitectura del Sistema y Stack Tecnológico

```mermaid
graph TD
    User([Usuario / Navegador]) <-->|HTTP / Static Assets| FastAPI[FastAPI App (main.py)]
    FastAPI <-->|SQL Queries| DB[(SQLite: data/routes.db)]
    FastAPI <-->|Normalización & Fallback| Geo[Servicio Geocoding (services/geocoding.py)]
    FastAPI <-->|Trazado Vial & Caché| Route[Servicio Routing (services/routing.py)]
    Geo <-->|Fallback Nominatim| OSM[OpenStreetMap API]
    Geo <-->|Caché Coordenadas| DB
    Route <-->|Driving Waypoints| OSRM[OSRM Routing Project]
    Route <-->|Caché Geometrías| DB
    FastAPI -->|Entrega HTML/CSS/JS| Client[Frontend SPA]
    Client <-->|Leaflet 1.9.4| Tiles[Esri & OSM Tile Servers]
```

### Tecnologías Utilizadas:
| Capa | Tecnología | Justificación |
|---|---|---|
| **Backend** | Python 3.12+, FastAPI, Uvicorn | Rendimiento asíncrono, OpenAPI nativo, procesamiento liviano |
| **Persistencia** | SQLite 3 (`data/routes.db`) | Sin dependencias de servidores externos, portable y rápido |
| **Georreferenciación** | Catálogo Local + OSM Nominatim | 80+ ciudades argentinas pre-cargadas sin latencia, fallback web |
| **Cálculo Vial** | OSRM Driving Engine | Geometrías de carreteras reales paso a paso con distancias exactas |
| **Frontend Core** | HTML5 Semántico, ES6 Vanilla JS | Cero dependencias npm, carga inmediata, arquitectura orientada a clases |
| **Mapa** | Leaflet.js 1.9.4 | Liviano, flexible, soporte completo de polylines, popups y divIcons personalizados |
| **Estilos** | CSS3 Vanilla con Custom Properties | Dark mode glassmorphism, responsive, animaciones fluidas de GPU |
| **Iconografía y Tipografía** | FontAwesome 6, Google Fonts (Outfit & Plus Jakarta Sans) | Aspecto corporativo moderno y de alta legibilidad |

---

## 3. Estructura del Proyecto y Archivos

```
credifin_lanzamiento/
├── data/
│   └── routes.db                   # Base de datos SQLite (creada dinámicamente)
├── services/
│   ├── __init__.py
│   ├── geocoding.py                # Normalizador de provincias, catálogo y Nominatim
│   └── routing.py                  # Integración OSRM, cálculo Haversine y curvas Bézier
├── static/
│   ├── css/
│   │   └── style.css               # Sistema de diseño completo Dark Glassmorphism
│   ├── js/
│   │   ├── api.js                  # Cliente fetch para interactuar con la API REST
│   │   ├── map.js                  # Controlador Leaflet: capas, nodos únicos, polylines
│   │   └── app.js                  # Controlador general: estado, modal, filtros y drawer
│   └── index.html                  # Estructura del SPA y modales
├── database.py                     # Inicialización y métodos CRUD de SQLite
├── main.py                         # Servidor FastAPI, endpoints REST y parsing CSV
├── requirements.txt                # Dependencias Python
├── sample_routes.csv               # Dataset de ejemplo listo para importar
├── update_road_trajectories.py      # Script de mantenimiento para re-calcular trazados
├── verify_cities.py                # Script de auditoría de ciudades y provincias
├── test_backend.py                 # Script de prueba unitaria de endpoints y DB
├── test_preview.py                 # Script de prueba del endpoint de preview CSV
└── test_upload.py                  # Script de prueba de upload (replace y append)
```

---

## 4. Esquema de Base de Datos SQLite y Caché Persistente

Ubicación del archivo: `data/routes.db`. La función `init_db()` en `database.py` crea automáticamente las siguientes tablas:

### 4.1. Tabla `routes`
Almacena cada tramo logístico importado:
```sql
CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo TEXT NOT NULL,
    ciudad1 TEXT NOT NULL,
    provincia1 TEXT,
    ciudad2 TEXT NOT NULL,
    lat1 REAL NOT NULL,
    lon1 REAL NOT NULL,
    lat2 REAL NOT NULL,
    lon2 REAL NOT NULL,
    distance_km REAL DEFAULT 0,
    geometry_json TEXT,              -- JSON con lista de coordenadas [[lat, lon], ...]
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2. Tabla `geocache`
Evita consultas repetidas a servicios de geocodificación externos:
```sql
CREATE TABLE IF NOT EXISTS geocache (
    query TEXT PRIMARY KEY,          -- Ej: "villa maria, cordoba"
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    display_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.3. Tabla `route_geometry_cache`
Almacena el trazado vial de alta resolución calculado por OSRM para evitar latencias en cargas masivas:
```sql
CREATE TABLE IF NOT EXISTS route_geometry_cache (
    cache_key TEXT PRIMARY KEY,      -- Formato: "{lat1},{lon1}_{lat2},{lon2}" redondeado a 4 decimales
    distance_km REAL NOT NULL,
    geometry_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

> **Optimización Clave**: La función `get_cached_route()` comprueba la clave directa y la inversa (`cache_key` y `cache_key_reverse`). Si la ruta de retorno `B -> A` se solicita, invierte el arreglo de coordenadas en memoria sin consultar de nuevo a internet.

---

## 5. Motor de Geocodificación y Verificación Exacta

El archivo `services/geocoding.py` resuelve el desafío de normalizar nombres de ciudades y provincias en Argentina:

### 5.1. Normalización de Texto y Provincias
- Elimina acentos mediante descomposición Unicode `NFKD` (`ASCII ignore`).
- Convierte a minúsculas y elimina caracteres especiales.
- Mapea alias populares:
  - `"caba"`, `"capital federal"`, `"bs as"`, `"pba"` ➔ `"buenos aires"`
  - `"cba"` ➔ `"cordoba"`
  - `"sta fe"`, `"sf"` ➔ `"santa fe"`
  - `"e rios"`, `"er"` ➔ `"entre rios"`
  - `"ctes"` ➔ `"corrientes"`, etc.

### 5.2. Catálogo Preestablecido `PRESET_CITY_PROVINCE`
Mapea pares `(ciudad_normalizada, provincia_normalizada)` con sus coordenadas oficiales:
- Cobertura de Buenos Aires / AMBA (La Plata, Mar del Plata, Bahía Blanca, Tandil, Olavarría, Pergamino, San Nicolás, etc.).
- Cobertura Córdoba (Córdoba Capital, Río Cuarto, Villa María, San Francisco, Bell Ville, Jesús María, etc.).
- Cobertura Santa Fe (Rosario, Santa Fe Capital, Rafaela, Venado Tuerto, Reconquista, Esperanza, etc.).
- Cobertura Litoral, Cuyo, NOA y Patagonia (Paraná, Concordia, Corrientes, Posadas, Mendoza, San Juan, San Luis, Tucumán, Salta, Jujuy, Neuquén, Bariloche, Ushuaia, etc.).

### 5.3. Clasificación de Coincidencia (`check_city_province_exact`)
Devuelve un objeto de evaluación:
```python
{
    "exact_found": True, # Booleano
    "match_type": "EXACT_PRESET" | "EXACT_GEOCODED" | "CITY_ONLY" | "PROVINCE_MISMATCH" | "NOT_FOUND",
    "lat": -31.4201,
    "lon": -64.1888,
    "display_name": "Córdoba, Córdoba",
    "details": "Explicación legible para auditoría"
}
```

---

## 6. Motor de Enrutamiento Vial (OSRM) y Geometrías Reales

El archivo `services/routing.py` convierte dos puntos geográficos en un recorrido real de carretera:

1. **OSRM Driving API**:
   - Endpoint: `https://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=full&geometries=geojson`
   - Extrae `route["geometry"]["coordinates"]` (que viene en `[lon, lat]`).
   - Invierte los puntos a formato Leaflet: `[[lat, lon], ...]`.
   - Distancia en kilómetros: `route["distance"] / 1000.0` redondeado a 1 decimal.

2. **Cálculo de Punto Medio para Etiquetas de Kilometraje**:
   - `getMidpointCoordinate(points)`: No toma el punto medio numérico, sino el punto que acumula el 50% de la distancia recorrida a lo largo de la polilínea, garantizando que el badge flotante quede visualmente en el centro de la ruta.

3. **Fallback Resiliente**:
   - Si OSRM no responde (problemas de red o timeout), calcula la distancia directa con la fórmula de Haversine y aplica un factor de ajuste vial de `1.18` (18% adicional sobre la distancia ortodrómica).
   - Genera una curva Bézier cuadrática de 30 puntos para mantener la fluidez visual sobre el mapa.

---

## 7. Especificación de la API REST (FastAPI)

| Método | Endpoint | Parámetros | Descripción |
|---|---|---|---|
| `GET` | `/` | Ninguno | Sirve la aplicación SPA (`static/index.html`). |
| `POST` | `/api/preview` | `file`: Archivo CSV (Multipart) | Analiza el CSV sin guardarlo. Devuelve previsualización fila por fila, badges de match exacto y resumen estadístico. |
| `POST` | `/api/upload` | `file`: CSV, `mode`: `"replace"` \| `"append"` | Procesa el archivo, calcula trayectorias viales en paralelo con `ThreadPoolExecutor`, persiste en SQLite y retorna estadísticas actualizadas. |
| `POST` | `/api/sample` | Ninguno | Carga de forma automática las rutas de prueba incluidas en `sample_routes.csv`. |
| `GET` | `/api/routes` | `grupo`: Opcional (filtro por grupo) | Retorna la lista de rutas con sus geometrías decodificadas desde JSON. |
| `GET` | `/api/groups` | Ninguno | Retorna los grupos existentes con el conteo de rutas de cada uno ordenado descendentemente. |
| `GET` | `/api/stats` | Ninguno | Retorna `{ total_routes, total_groups, total_cities, total_km }`. |
| `DELETE` | `/api/routes` | Ninguno | Trunca la tabla de rutas en SQLite. |
| `GET` | `/api/download-template` | Ninguno | Descarga el CSV modelo (`plantilla_rutas_credifin.csv`). |

---

## 8. Diseño Frontend: Sistema Visual, Mapas y Componentes

### 8.1. Tokens y Variables CSS (`static/css/style.css`)
```css
:root {
  --bg-dark: #0B0F19;
  --bg-card: rgba(17, 24, 39, 0.86);
  --border-subtle: rgba(255, 255, 255, 0.1);
  --primary: #6366F1;         /* Indigo Neon */
  --cyan: #06B6D4;            /* Cyan Highlight */
  --success: #10B981;         /* Verde Esmeralda */
  --font-family: 'Plus Jakarta Sans', sans-serif;
  --font-display: 'Outfit', sans-serif;
}
```

### 8.2. Componentes Clave del Mapa (`static/js/map.js`)
1. **Deduplicación de Nodos de Ciudad**:
   - Si 15 rutas pasan por "Rosario", en el mapa **sólo se dibuja 1 marcador interactivo**, evitando solapamientos y artefactos gráficos.
   - El nodo muestra un badge con el número de rutas activas conectadas.
2. **Popup Enriquecido con Navegación Bidireccional**:
   - Muestra el nombre oficial de la localidad, provincia, coordenadas y dos secciones scrolleables:
     - **Salidas hacia**: Rutas donde la ciudad es origen (`ciudad1`).
     - **Conexiones de llegada**: Rutas donde la ciudad es destino (`ciudad2`).
   - Cada elemento contiene botón "Ver ruta" que invoca `focusRoute(id)`.
3. **Marcador de Kilómetros en Trayectoria**:
   - Cada carretera contiene un badge píldora flotante con la distancia (ej: `565.9 km`).
   - Se puede activar o desactivar dinámicamente con el botón "Distancias (km)" del mapa.
4. **Animación de Enfoque (`focusRoute`)**:
   - Ejecuta `map.flyToBounds(...)` hacia la polilínea.
   - Genera un pulso luminoso aumentando el grosor de la línea temporalmente y abre el popup de la ciudad de origen.

---

## 9. Formatos de Archivos, Datos de Muestra y CSV Flexible

### 9.1. Formato Oficial de CSV Requerido
El archivo CSV debe contener como mínimo las siguientes 4 columnas (el orden o mayúsculas es indiferente):
```csv
Grupo,Ciudad 1,Provincia-Ciudad1,Ciudad2
Zona Centro,Cordoba,Cordoba,Rosario
Zona Centro,Cordoba,Cordoba,Buenos Aires
Corredor Atlantico,Buenos Aires,Buenos Aires,Mar del Plata
Cuyo Express,Mendoza,Mendoza,San Juan
Litoral,Rosario,Santa Fe,Parana
```

### 9.2. Columnas Opcionales para Coordenadas Pre-definidas
Si el usuario ya dispone de coordenadas exactas, el sistema las respeta automáticamente sin llamar a la geocodificación:
```csv
Grupo,Ciudad 1,Provincia-Ciudad1,Ciudad2,lat1,lon1,lat2,lon2
Especial,Cordoba,Cordoba,Rosario,-31.4201,-64.1888,-32.9468,-60.6393
```

---

## 10. Instrucciones para Despliegue y Ejecución Local

1. Instalar las dependencias:
   ```bash
   pip install -r requirements.txt
   ```
2. Iniciar el servidor Uvicorn:
   ```bash
   python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```
3. Abrir en el navegador:
   ```
   http://127.0.0.1:8000
   ```
4. Probar la aplicación haciendo clic en el botón **"Ejemplo"** del header o arrastrando un archivo CSV en **"Subir CSV"**.
