# Test Searchback

Chrome Web Store review may not finish before the BuildAnything Spark Hackathon deadline. You can test the exact submitted build locally in about two minutes.

## Install the release build

1. Download [`searchback-1.0.1.zip`](https://github.com/Luciano655dev/searchback-extension/releases/latest/download/searchback-1.0.1.zip). Do not download GitHub's automatically generated source archive.
2. Extract the ZIP to a folder you can keep. The extracted folder should contain `manifest.json`, `background.js`, and `content.js` at its top level.
3. Open `chrome://extensions` in Google Chrome.
4. Enable **Developer mode** in the top-right corner.
5. Select **Load unpacked**.
6. Choose the extracted Searchback folder. Select the folder, not the `manifest.json` file.
7. Open Searchback from Chrome's Extensions menu and select **Finish setup**.
8. Read the local-data explanation, then select **Start Searchback**.

Chrome may display a warning for extensions installed in Developer mode. This is expected for an unpacked hackathon build.

## Verify the main feature now

1. Searchback opens its built-in **Hackathon test guide** after setup. You can also reach it from **Test Searchback** in the dashboard.
2. Select **Load sample research**. This adds several realistic, pre-dated research trails to Chrome's local extension storage. It does not upload anything.
3. Copy this test query:

   ```text
   why is my mac storage full again
   ```

4. Try one or both surfaces:
   - Google: search the query. Searchback should place prior Mac-storage research above the results.
   - ChatGPT or Claude: paste or type the query into the composer. Before you send it, Searchback should show a full-width reminder above the text box.
5. Open a suggested result, confirm a solution, select **View all**, or dismiss the reminder with the top-right ×.
6. Open the Searchback dashboard to inspect the searches and pages that were recovered.
7. Open **Settings** to disable reminders globally, on Google, on all chatbots, or on individual chatbot sites.

## Test with real browsing

Search for the same problem with related wording on two different days and open useful pages after each Google search. Searchback will group that research automatically. Sent prompts on supported chatbots can also become part of the local research trail.

## Privacy and cleanup

Searchback has no account, analytics, advertising, remote database, or Searchback server. Matching and storage happen locally. Typed chatbot text is checked locally and is not stored unless the prompt is sent.

Open **Dashboard → Privacy & data → Delete all data** to remove both sample and real Searchback data. Chrome history itself is never changed.

- [Privacy policy](https://searchback.vercel.app/privacy)
- [Report a problem](https://github.com/Luciano655dev/searchback-extension/issues)
