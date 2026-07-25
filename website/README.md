# Searchback website

The public website and privacy policy for Searchback. This is the `website/` workspace of the
[Searchback monorepo](../README.md).

- Production: [searchback.vercel.app](https://searchback.vercel.app/)
- Privacy policy: [searchback.vercel.app/privacy](https://searchback.vercel.app/privacy)
- Install: [Searchback on the Chrome Web Store](https://chromewebstore.google.com/detail/searchback/aiefiangapjlhohdlaabcgiakcapkekp)

## Development

From the repository root:

```bash
npm install            # installs all workspaces
npm run dev:website    # start the Vite dev server
```

Or from inside this directory:

```bash
npm run dev
```

## Production build

```bash
npm run build:website  # from the repo root
# or, from this directory:
npm run build
```

## Deployment

Deployed to Vercel with the **Vite** preset. Because the site lives in this subdirectory, the
Vercel project's **Root Directory** must be set to `website`. Full instructions are in the
[monorepo README](../README.md#deploying-the-website-to-vercel). No environment variables are
required; security headers and clean URLs are configured in [`vercel.json`](vercel.json).
