# Searchback extension

Searchback remembers problems you researched before, so you do not start from zero next time.
This is the `extension/` workspace of the [Searchback monorepo](../README.md).

- Install: [Searchback on the Chrome Web Store](https://chromewebstore.google.com/detail/searchback/aiefiangapjlhohdlaabcgiakcapkekp)
- Website: [searchback.vercel.app](https://searchback.vercel.app/)
- Privacy policy: [searchback.vercel.app/privacy](https://searchback.vercel.app/privacy)

## Test the hackathon build

Chrome Web Store review may not finish before the BuildAnything Spark Hackathon deadline. The signed-off release package can be loaded directly into Chrome:

1. Download [`searchback-1.0.1.zip`](https://github.com/Luciano655dev/searchback-extension/releases/latest/download/searchback-1.0.1.zip).
2. Extract the ZIP.
3. Open `chrome://extensions` in Chrome and enable **Developer mode**.
4. Select **Load unpacked**, then choose the extracted folder containing `manifest.json`.
5. Finish onboarding and select **Start Searchback**.
6. From the dashboard, select **Test Searchback** and then **Load sample research**.
7. Search Google for `why is my mac storage full again`, or type it into ChatGPT or Claude.

Searchback should recover the earlier Mac-storage research. On a chatbot, the reminder appears across the full composer before the prompt is sent.

See [TESTING.md](TESTING.md) for the complete judge/tester walkthrough, expected results, real-browsing test, privacy details, and cleanup.

## What it does

Searchback groups related Google searches and the pages opened afterward. When the topic returns on Google or a supported AI chatbot, it brings back the prior searches, useful pages, confirmed solution, and related chat conversation.

Matching, ranking, and storage happen locally. Searchback has no account, remote database, analytics, ads, or remote code.

## Supported reminder surfaces

- Google Search
- ChatGPT
- Claude
- Gemini
- Perplexity
- Copilot
- Grok
- Groq
- DeepSeek

Reminder settings can disable Searchback everywhere, control Google and chatbots independently, or block an individual chatbot. These settings do not delete saved research.

## First run and privacy

Searchback does not process history or sent prompts until the user completes onboarding and selects **Start Searchback**. The extension then stores relevant browsing metadata locally in `chrome.storage.local`. Users can remove individual items or delete all Searchback data from the dashboard.

See the public [privacy policy](https://searchback.vercel.app/privacy) for the complete disclosure.

## Development

Requires Node.js 22.

```bash
npm install
npm run dev
```

Open `http://localhost:5173/dashboard.html` or `/popup.html`. Development mode uses `localStorage`. The dashboard's **Test Searchback** guide can load sample research.

## Tests and production package

```bash
npm test
npm run build
npm run release
```

`npm run release` runs all tests, builds the Manifest V3 extension, validates the package contents, and creates:

```text
release/searchback-1.0.1.zip
release/searchback-1.0.1.zip.sha256
```

The ZIP contains `manifest.json` at its root and is ready for Chrome Web Store upload.

## Load the production build locally

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose `dist/`.

## Chrome Web Store material

- Listing copy and privacy answers: [`store-listing/en-US.md`](store-listing/en-US.md)
- Reviewer instructions: [`store-listing/reviewer-notes.md`](store-listing/reviewer-notes.md)
- Store graphics: `store-assets/`
- Release checklist: [`RELEASING.md`](RELEASING.md)

## Permissions

| Permission | Use |
| --- | --- |
| `history` | Read recent Google searches and the pages visited afterward. History is never modified. |
| `storage` | Store research, settings, notes, and solutions locally. |
| `tabs` | Detect supported search navigation and open user-selected Searchback pages. |
| `notifications` | Show a fallback reminder where the in-page Google reminder is unavailable. |
| `alarms` | Refresh local history after the service worker sleeps. |
| `favicon` | Read site icons from Chrome's local favicon cache. |
| Listed Google and chatbot domains | Read the active search or prompt input locally and display the reminder. |

## Architecture

```text
src/core/        deterministic matching, clustering, and ranking
src/storage/     local repository abstraction
src/background/  Manifest V3 service worker
src/content/     in-page reminder content script
src/dashboard/   settings, privacy, and research dashboard
src/popup/       extension action popup
tests/           unit and regression tests
```

The internal `loopback:*` message and storage keys are intentionally retained for upgrade compatibility with early local builds.
