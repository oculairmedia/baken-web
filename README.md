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

## Audience variants

The home page has two versions of some copy: **Overview** (default, plain language) and **Technical** (full detail, plus the "Under the hood" section). An inline script in `Layout.astro` picks one before first paint, in this order:

1. `?for=technical` or `?for=everyone` in the URL (remembered in `localStorage`)
2. the visitor's earlier choice from the hero toggle (`localStorage`)
3. `utm_source` starting with `github`, `hn`, `lobsters`, `selfhosted`, `localllama`, `homelab` and similar, or a referrer from GitHub, GitLab, Codeberg, Hacker News, Lobsters, dev.to, Stack Overflow or Hugging Face (remembered for the session)
4. otherwise **Overview**

Mark an element `data-aud="technical"` or `data-aud="everyone"` to show it to one audience only. Use `?for=technical` on links from the repository README, release notes and developer communities; links in plain-language channels need nothing.
