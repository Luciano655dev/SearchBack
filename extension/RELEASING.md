# Release Searchback

## Automated checks

```bash
npm ci
npm run release
npm audit
```

Confirm that all tests pass, the production build succeeds, the audit reports zero vulnerabilities, and `release/searchback-<version>.zip` is created.

## Versioning

Before every upload, increase both versions to the same value:

- `package.json`
- `public/manifest.json`

Chrome requires every uploaded manifest version to be greater than the previous store version.

## Manual production test

1. Load `dist/` as an unpacked extension in a clean Chrome profile.
2. Confirm no history is processed before **Start Searchback** is selected.
3. Complete onboarding and confirm the initial scan runs.
4. Verify Google reminder matching, the top-right exact-query dismissal, and permanent ignore with Undo.
5. Verify at least one supported chatbot composer.
6. Open **Test Searchback**, load the sample research in an empty profile, and verify the documented Google and chatbot test query.
7. Verify global, Google, chatbot, and individual-site settings.
8. Verify dashboard editing and **Delete all data**.
9. Check the extension service worker console for errors.

## Store submission

1. Upload the ZIP from `release/`.
2. Copy the listing and privacy answers from `store-listing/en-US.md`.
3. Upload the 128px icon, screenshots, and 440x280 small promo tile from `store-assets/`.
4. Add `https://searchback.vercel.app/privacy` as the privacy policy.
5. Add `https://github.com/luciano655dev/searchback-extension/issues` as support.
6. Add the reviewer test flow from `store-listing/reviewer-notes.md`.
7. Confirm public distribution, contact email verification, and 2-Step Verification.
8. Submit for review.

The first listing and Privacy tabs must be completed in the Chrome Web Store Developer Dashboard before API publication is available.
