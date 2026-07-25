/**
 * AI chat sites where the banner watches the prompt box (read-only, while
 * typing) and shows previous research BEFORE the question is sent.
 * MUST stay in sync with content_scripts.matches in public/manifest.json
 * (gemini.google.com is already covered there by *.google.com).
 */
export const CHAT_SITES = [
  { id: "chatgpt", label: "ChatGPT", hosts: ["chatgpt.com", "chat.openai.com"] },
  { id: "claude", label: "Claude", hosts: ["claude.ai"] },
  { id: "gemini", label: "Gemini", hosts: ["gemini.google.com"] },
  { id: "perplexity", label: "Perplexity", hosts: ["perplexity.ai", "www.perplexity.ai"] },
  { id: "copilot", label: "Copilot", hosts: ["copilot.microsoft.com"] },
  { id: "grok", label: "Grok", hosts: ["grok.com"] },
  { id: "groq", label: "Groq", hosts: ["groq.com"] },
  { id: "deepseek", label: "DeepSeek", hosts: ["chat.deepseek.com"] },
] as const;

export const CHAT_HOSTS = CHAT_SITES.flatMap((site) => [...site.hosts]);

export function isChatHost(hostname: string): boolean {
  return CHAT_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}
