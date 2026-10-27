# ORION Core — Desktop

Application bureau (Electron) qui **réutilise le code source** de `../orion-core`.
Onboarding, connexion, inscription, hub, connexions : **identique à Core web**.

## Prérequis

- Node.js 20+
- Dossier `../orion-core` présent (même repo ORION)

## Démarrage

```bash
cd "logiciel-desktop"
npm install
npm run dev
```

Ouvre la fenêtre **ORION Core** sur `http://127.0.0.1:5175`.

## Build installateur Windows

```bash
npm run dist
```

Sortie dans `release/`.

## Google OAuth

Dans Google Cloud Console → Client OAuth Web, ajoute l’origine :

- `http://127.0.0.1:5175`
- `http://localhost:5175`

## Architecture

| Couche | Rôle |
|--------|------|
| `electron/` | Fenêtre native, serveur local packagé |
| `vite.config.ts` | Monte `../orion-core` comme root UI |
| `.env` | Mêmes clés Supabase / Google que Core web |
