# Searchback

**Stop solving the same problem twice.** Searchback remembers the searches and pages that
solved a problem, then brings them back the next time the problem shows up — right beside your
search box, before you start over.

- 🧩 **Install:** [Searchback on the Chrome Web Store](https://chromewebstore.google.com/detail/searchback/aiefiangapjlhohdlaabcgiakcapkekp)
- 🌐 **Website:** [searchback.vercel.app](https://searchback.vercel.app/)
- 🔒 **Privacy policy:** [searchback.vercel.app/privacy](https://searchback.vercel.app/privacy)

This repository is a **monorepo** containing both halves of the project.

## Repository layout

```
searchback/
├── website/     # Public marketing site + privacy policy (Vite + React → Vercel)
├── extension/   # Manifest V3 Chrome extension + Chrome Web Store release package
├── package.json # npm workspaces root (shared install, top-level scripts)
└── .github/     # CI workflows (one per workspace, path-filtered)
```

Each workspace keeps its own `README`, build config, and detailed docs:

- [`website/README.md`](website/README.md)
- [`extension/README.md`](extension/README.md) · [`extension/TESTING.md`](extension/TESTING.md) · [`extension/RELEASING.md`](extension/RELEASING.md)

## Prerequisites

- **Node.js 22+** and **npm 9+** (npm workspaces).

## Getting started

Install every workspace's dependencies with a single command from the repo root:

```bash
npm install
```

Dependencies are hoisted to the root `node_modules` and pinned by the root `package-lock.json`.

## Common commands

Run these from the repository root:

| Command | What it does |
| --- | --- |
| `npm install` | Install all workspaces (hoisted). |
| `npm run dev:website` | Start the website dev server (Vite). |
| `npm run dev:extension` | Start the extension dev build (Vite watch). |
| `npm run build` | Build every workspace. |
| `npm run build:website` | Build the website only. |
| `npm run build:extension` | Build the extension only. |
| `npm test` | Run the extension test suite (Vitest). |
| `npm run release:extension` | Test, build, and package the extension for the Chrome Web Store. |

You can also target a workspace directly, e.g. `npm run dev --workspace searchback-website`,
or `cd website && npm run dev`.

## Website (`website/`)

A static Vite + React site deployed to Vercel.

```bash
npm run dev:website     # local dev server
npm run build:website   # production build → website/dist
```

### Deploying the website to Vercel

The website lives in the `website/` subdirectory, so Vercel must be told to treat that folder
as the project root. There are two ways to set this up.

**Option A — Vercel Dashboard (recommended)**

1. Push this monorepo to GitHub (see [Publishing](#publishing-to-github) below).
2. In Vercel, click **Add New… → Project** and import the `searchback` repository.
3. Under **Root Directory**, click **Edit** and select **`website`**. This is the key step —
   it makes Vercel install, build, and deploy from that folder only.
4. Framework preset should auto-detect as **Vite**. Leave the defaults:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`
5. No environment variables are required. Click **Deploy**.
6. (Optional) In **Settings → Git**, enable *"Only build when there are changes in the Root
   Directory"* so extension-only commits don't trigger website deploys.

Security headers and clean URLs are already configured in [`website/vercel.json`](website/vercel.json).

**Option B — Vercel CLI**

```bash
npm i -g vercel
cd website
vercel          # first run links/creates the project — accept "./" as the root
vercel --prod   # deploy to production
```

> Already linked? The existing project is named `searchback`. After converting to a monorepo,
> just set its **Root Directory** to `website` in the dashboard (step 3 above) and redeploy —
> no need to create a new project.

## Extension (`extension/`)

A Manifest V3 Chrome extension. Matching, ranking, and storage all happen locally — no account,
server, analytics, or remote code.

```bash
npm run dev:extension       # watch build for local development
npm run build:extension     # production build → extension/dist
npm test                    # run the Vitest suite
npm run release:extension   # test + build + package a store-ready zip → extension/release
```

To load a local build: open `chrome://extensions`, enable **Developer mode**, choose
**Load unpacked**, and select `extension/dist`. Full tester and release walkthroughs are in
[`extension/TESTING.md`](extension/TESTING.md) and [`extension/RELEASING.md`](extension/RELEASING.md).

## Continuous integration

GitHub Actions runs a workflow per workspace, each filtered to only run when relevant files
change:

- [`.github/workflows/website.yml`](.github/workflows/website.yml) — builds the website.
- [`.github/workflows/extension.yml`](.github/workflows/extension.yml) — tests, builds, and
  uploads the packaged extension as an artifact.

## Publishing to GitHub

This monorepo replaces the previous split repositories (`searchback-website` and
`searchback-extension`). To publish it as a single repo:

```bash
git init
git add .
git commit -m "Initialize Searchback monorepo"
git branch -M main
git remote add origin https://github.com/Luciano655dev/searchback.git
git push -u origin main
```

Built for the [BuildAnything Spark Hackathon](https://buildanything.so/hackathons/spark) by
[Luciano Menezes](https://github.com/luciano655dev).
