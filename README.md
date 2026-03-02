# Public Procurements Offerers Tagging

Pipeline para etiquetar licitaciones con la cantidad de oferentes. Usa Digital Ocean Spaces como almacenamiento.

## Configuración

```bash
cp .env.example .env
```

Configurá `DO_SPACES_BUCKET`, `DO_SPACES_ACCESS_KEY_ID`, `DO_SPACES_SECRET_ACCESS_KEY` y los prefixes (`DO_SPACES_PREFIX_INPUT`, `DO_SPACES_PREFIX_PDFS`, `DO_SPACES_PREFIX_RESULTS`).

## Scripts

### 1. Generar IDs

Obtiene licitaciones de la API DNCP y sube `ids.json` al bucket:

```bash
npm run generate-ids
```

### 2. Extraer PDFs

Descarga Acta de Apertura y Cuadro Comparativo de Ofertas desde la API DNCP y los sube al bucket:

```bash
npm run extract-pdfs
```

**Ejecución paralela** (varias computadoras):

```bash
# Computadora 1
npm run extract-pdfs -- --worker-id=0 --total-workers=3

# Computadora 2
npm run extract-pdfs -- --worker-id=1 --total-workers=3

# Computadora 3
npm run extract-pdfs -- --worker-id=2 --total-workers=3
```

### 3. Tagging (interfaz web)

```bash
# Terminal 1 - Backend
npm run start:dev

# Terminal 2 - Frontend
npm run frontend
```

- API: http://localhost:3000/api
- UI: http://localhost:5173

## Producción

```bash
npm run build
cd frontend && npm run build
npm run start:prod
```

El frontend se sirve desde NestJS en http://localhost:3000 (las rutas `/api/*` van al backend).

## Estructura en el bucket

| Prefix | Contenido |
|--------|-----------|
| `tagging/input` | `ids.json` (generado por generate-ids) |
| `tagging/pdfs` | `{tenderId}-ada.pdf`, `{tenderId}-cco.pdf` |
| `tagging/results` | `{tenderId}.json` (resultados del tagging) |
