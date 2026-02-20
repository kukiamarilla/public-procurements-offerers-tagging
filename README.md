# Public Procurements Offerers Tagging

Pipeline de tagging para licitaciones públicas. Permite etiquetar licitaciones con la cantidad de oferentes usando Digital Ocean Spaces como almacenamiento.

## Arquitectura

- **Input prefix**: IDs de licitaciones (archivos JSON o manifest ids.json/ids.txt)
- **PDFs prefix**: PDFs extraídos por licitación (formato `{tenderId}.pdf`)
- **Results prefix**: Resultados del tagging (JSON por licitación)

## Configuración

Copia `.env.example` a `.env` y configura las variables:

```bash
cp .env.example .env
```

Variables principales:

| Variable | Descripción |
|----------|-------------|
| `DO_SPACES_BUCKET` | Nombre del bucket en Digital Ocean |
| `DO_SPACES_REGION` | Región (ej: `tor1`) |
| `DO_SPACES_ENDPOINT` | URL del endpoint (ej: `https://tor1.digitaloceanspaces.com`) |
| `DO_SPACES_ACCESS_KEY_ID` | Access key |
| `DO_SPACES_SECRET_ACCESS_KEY` | Secret key |
| `DO_SPACES_PREFIX_INPUT` | Prefix para IDs de input (default: `tagging/input`) |
| `DO_SPACES_PREFIX_PDFS` | Prefix para PDFs (default: `tagging/pdfs`) |
| `DO_SPACES_PREFIX_RESULTS` | Prefix para resultados (default: `tagging/results`) |

## Formato de input

### Opción 1: Manifest ids.json

```json
["tender-id-1", "tender-id-2"]
```

O con más datos:

```json
[
  { "tenderId": "id-1", "offerers": [{ "id": "o1", "name": "Empresa A" }] },
  { "tenderId": "id-2", "offerers": [] }
]
```

### Opción 2: Manifest ids.txt

```
tender-id-1
tender-id-2
```

### Opción 3: Archivos individuales

`{tenderId}.json`. Cada licitación puede tener ocid, tenderId y varios awardIds:

```json
{
  "ocid": "ocds-213czf-AD-2024",
  "tenderId": "AD-123-2024",
  "awardIds": ["award-1", "award-2"],
  "offerers": [
    { "id": "1", "name": "Oferente A" },
    { "id": "2", "name": "Oferente B" }
  ]
}
```

## Generación de ids.txt (Placeholder)

El script `scripts/generate-ids.ts` genera y sube `ids.txt` al prefix de input. La constante `QUERY_PARAMS` en el script define los query params dinámicos.

```bash
npx ts-node scripts/generate-ids.ts
```

## Extracción de PDFs

El script `scripts/extract-pdfs.ts` extrae los PDFs. Debes implementar:

1. Lectura de IDs desde el prefix de input
2. Descarga de documentos de la API de contrataciones.gov.py (o fuente que uses)
3. Subida de PDFs al prefix de output

## Desarrollo

```bash
# Backend
npm install
npm run start:dev

# Frontend (en otra terminal)
cd frontend && npm install && npm run dev
```

- API: http://localhost:3000/api
- UI: http://localhost:5173 (proxea a la API)

## Producción

```bash
npm run build
cd frontend && npm run build
npm run start:prod
```

Para servir el frontend desde NestJS en producción, configura `ServeStaticModule` apuntando a `frontend/dist`.

## Datos de ejemplo

En `data/` hay ejemplos para subir al bucket:
- `sample-input.json` — licitación con oferentes
- `ids.json` — manifest con IDs

Sube estos archivos al prefix `tagging/input` de tu bucket para probar la interfaz.
