# Déploiement — RGPH 2024 Analytics

Deux services séparés : le backend (FastAPI, Docker) sur **Render**, le frontend (Next.js) sur **Vercel**.
Il faut déployer le backend en premier pour récupérer son URL, avant de configurer le frontend.

## 1. Pousser le dépôt sur GitHub

```bash
# Depuis la racine du projet (déjà git init + premier commit fait)
git remote add origin https://github.com/<votre-compte>/<votre-repo>.git
git branch -M main
git push -u origin main
```

Si le dépôt GitHub n'existe pas encore, créez-le d'abord sur github.com (repo vide, sans README ni .gitignore pour éviter les conflits).

## 2. Backend sur Render

1. Sur [render.com](https://render.com), **New +** → **Blueprint**, connectez votre dépôt GitHub.
2. Render détecte `render.yaml` à la racine et propose le service `rgph2024-backend` (Docker, plan gratuit).
3. Avant de déployer, laissez `CORS_ORIGINS` vide pour l'instant (on le remplira à l'étape 4) — ou déployez tel quel, on le modifiera après.
4. Déployez. Le build utilise `backend/Dockerfile` (Python 3.14, toutes les dépendances pinnées dans `requirements.txt`).
5. Une fois déployé, notez l'URL générée, du type `https://rgph2024-backend.onrender.com`.
6. Vérifiez : `https://rgph2024-backend.onrender.com/api/health` doit répondre `{"status":"ok"}`.

**Note plan gratuit Render** : le service s'endort après 15 min d'inactivité ; la première requête après veille prend ~30-60s (cold start). Passez à un plan payant pour éviter ça en production.

## 3. Frontend sur Vercel

1. Sur [vercel.com](https://vercel.com), **Add New** → **Project**, importez le même dépôt GitHub.
2. **Root Directory** : réglez-le sur `frontend` (important — le repo contient aussi `backend/`).
3. Framework Preset : Next.js (détecté automatiquement).
4. Dans **Environment Variables**, ajoutez :
   - `NEXT_PUBLIC_API_URL` = l'URL Render obtenue à l'étape 2 (ex. `https://rgph2024-backend.onrender.com`, **sans** slash final).
5. Déployez. Vercel donne une URL du type `https://rgph2024.vercel.app`.

## 4. Reconnecter le backend au frontend (CORS)

Le backend n'accepte par défaut que `localhost:3000`. Une fois l'URL Vercel connue :

1. Sur Render, ouvrez le service backend → **Environment**.
2. Réglez `CORS_ORIGINS` = `https://rgph2024.vercel.app` (l'URL Vercel exacte, sans slash final). Pour autoriser aussi les URLs de preview Vercel (`https://rgph2024-git-<branche>-<compte>.vercel.app`), séparez plusieurs origines par une virgule.
3. Sauvegardez → Render redéploie automatiquement.

## 5. Vérification finale

- Ouvrez l'URL Vercel : la Vue exécutive doit charger les KPI (preuve que le frontend atteint bien le backend).
- Si les KPI restent bloqués sur "Chargement…", ouvrez la console navigateur : une erreur CORS confirmerait une origine mal réglée à l'étape 4.

## Redéploiements ultérieurs

Chaque `git push` sur `main` redéploie automatiquement Render et Vercel (les deux surveillent le dépôt).
Si vous modifiez les données source (`backend/data/raw/*.xlsx`), regénérez les parquet en local
(`python -m app.engines.etl_engine` depuis `backend/`) et commitez `backend/data/processed/*.parquet`
avant de pousser — le build Docker ne relance pas l'ETL automatiquement.
