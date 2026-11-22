# baken.ca

Official marketing and docs website for **Baken**, built with **Astro** and deployed on **Cloudflare Workers Static Assets**.

## Local development

```bash
npm install
npm run dev
```

## Build & deploy

```bash
npm run build
CLOUDFLARE_API_TOKEN=<token> npx wrangler deploy
```

- Custom domains: `baken.ca`, `www.baken.ca` (`workers_dev: false`).
- Downloads point to `https://github.com/oculairmedia/letta-mobile/releases/latest`.
- Pushes to `main` deploy automatically via `.github/workflows/deploy.yml` once `CLOUDFLARE_API_TOKEN` is configured in repository secrets.
