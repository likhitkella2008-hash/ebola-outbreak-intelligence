# Ebola Outbreak Intelligence Dashboard — starter

A React + Vite dashboard built from the user's uploaded Bundibugyo Ebola CSV dataset. It is intended as the first UI/data-visualization milestone for the Mathematical Modelling project.

## What is implemented
- Hybrid design: dark overview dashboard and light scientific cards.
- Reads the provided dataset from `public/ebola_dataset.json`.
- Shows cumulative cases/deaths, weekly new cases, calculated case-fatality ratio, and a records table.
- Includes planned-workspace pages for an Ebola-specific mathematical model and PINN, clearly labelled as not yet implemented/trained.
- Vercel configuration for the Vite single-page frontend.

## Important scientific limitation
The existing project models human–vector transmission. Ebola is not mosquito-borne, so its model must be formulated separately. The equations displayed in the mathematical-model page are an illustrative model skeleton, not a fitted/validated model. The dashboard does not currently run an Ebola ODE simulation or an Ebola PINN.

The CSV's values are displayed as supplied and are not independently verified by this application. Verify the original source before presenting them as authoritative outbreak statistics.

## Run locally
Install Node.js (LTS) first, then open a terminal in this folder and run:

```bash
npm install
npm run dev
```

Vite will print a local address, commonly `http://localhost:5173`.

To test the production build:

```bash
npm run build
npm run preview
```

## Deploy to Vercel
1. Create a GitHub repository and upload the contents of this folder.
2. Sign in to Vercel and import the repository.
3. Framework preset: **Vite**.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Deploy.

This deployment is the frontend/data dashboard only. Python ODE solving and PINN training must be implemented and connected in a later phase; depending on runtime needs, the Python service may need separate hosting.
