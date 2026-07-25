# Chrome Web Store listing

## Product details

Name: Searchback

Category: Productivity

Language: English

Short description:

> Searchback remembers problems you researched before, so you do not start from zero next time.

Detailed description:

> Searchback brings your own previous research back when a similar problem returns.
>
> It notices recurring Google searches and prompts sent to supported AI chatbots. The searches, useful pages, chat links, notes, and confirmed solutions stay organized locally on your device.
>
> When the topic returns, Searchback can show:
>
> - Searches you made on previous days
> - Pages you opened while researching
> - A solution you previously confirmed
> - A locally ranked likely solution when the page clearly matches the topic
> - Your last related chatbot conversation
>
> Searchback has no account, server, telemetry, advertising, or remote database. You can control where reminders appear, ignore individual problems, remove pages, or delete all saved Searchback data at any time.

Website: https://searchback.vercel.app/

Privacy policy: https://searchback.vercel.app/privacy

Support: https://github.com/luciano655dev/searchback-extension/issues

## Single purpose

Help users recover their own prior research when a similar problem returns, using browsing and chatbot activity stored only on their device.

## Permission justifications

- `history`: Reads recent Google search URLs and pages visited afterward so repeated research can be grouped and recovered. Searchback never modifies browser history.
- `storage`: Saves detected research, user settings, notes, ignored problems, and confirmed solutions locally on the device.
- `tabs`: Detects supported Google search navigations promptly and opens Searchback pages or a user-selected prior result.
- `notifications`: Provides a fallback reminder on supported Google domains where the in-page reminder is unavailable.
- `alarms`: Runs a bounded local history refresh periodically so research remains current after the service worker sleeps.
- `favicon`: Displays site icons from Chrome's local favicon cache next to saved pages.
- Site access: Runs the reminder only on listed Google Search and supported AI chatbot domains. It reads the active search or prompt input locally to find related prior research.

## Privacy practices answers

- Remote code: No. All executable code is included in the extension package.
- Data handled: Web browsing activity, website interaction content entered into supported search/chat inputs, and user-provided Searchback notes/settings.
- Data transmission: None. Data is processed and stored locally and is not sent to the developer or third parties.
- Advertising: None.
- Human access: None.
- Limited Use certification: Yes. The extension's data use is limited to its disclosed research-recovery purpose.

## Distribution

Recommended first release: Public, all regions.

Before submission, confirm the publisher contact email, support URL, privacy policy URL, and 2-Step Verification in the Developer Dashboard.
