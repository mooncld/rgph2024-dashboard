# RGPH 2024 — Plateforme analytique

Plateforme d'exploration interactive des données du Recensement Général de la Population et de
l'Habitat 2024 (Haut-Commissariat au Plan, Maroc) : vue exécutive, module SIG, explorateur de
filtres universel, recherche en langage naturel, visualisations avancées.

## Structure

```
backend/    FastAPI + DuckDB — ETL, moteurs KPI/recherche/carte/export, API REST
frontend/   Next.js + Tailwind + Framer Motion + GSAP + ECharts + MapLibre
```

## Démarrage local

**Backend**
```bash
cd backend
python -m venv venv && venv/Scripts/pip install -r requirements.txt   # Windows
python -m app.engines.etl_engine   # génère data/processed/*.parquet depuis data/raw/*.xlsx
venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
npm run dev
```

Ouvrir http://localhost:3000.

## Déploiement

Voir [DEPLOY.md](./DEPLOY.md) (backend sur Render, frontend sur Vercel).
