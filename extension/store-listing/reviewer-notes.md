# Reviewer notes

Searchback's single purpose is to recover a user's own prior research when a similar problem returns.

## Test flow

1. Install the extension. No history is processed before onboarding is completed.
2. Complete onboarding by selecting **Start Searchback**.
3. The built-in **Hackathon test guide** opens. Select **Load sample research** to add local, pre-dated research using the production ingestion pipeline.
4. Search Google for `why is my mac storage full again`, or type it into ChatGPT or Claude. Searchback shows the previous Mac-storage research; on chatbots it appears above the composer before the prompt is sent.
5. Open the extension dashboard to review the grouped research, confirm a solution, or delete the data.
6. Open **Settings** to disable reminders globally, on Google, across chatbots, or on one supported chatbot.

For a natural history test instead, search a technical topic on two different calendar days and open a few result pages after each search. Searchback will group and recover the research automatically.

All matching, ranking, and storage happen locally. The extension does not make network requests to a Searchback server and does not execute remote code.
