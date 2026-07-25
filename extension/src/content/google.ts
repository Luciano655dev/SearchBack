import type { LiveMatch, LiveMatchPage } from "../core/liveMatch";
import { faviconUrl } from "../ui/favicon";
import { isChatHost } from "../core/chatHosts";
import { reminderDismissKey } from "../core/reminderDismissal";

/**
 * Runs only on Google pages and AI chat sites (see manifest
 * content_scripts.matches). Shows the Searchback card three ways:
 *  - anchored above Google results when the page IS a search for a known problem
 *  - floating while the user is still TYPING a matching Google query
 *  - floating above the composer on AI chat sites, BEFORE the prompt is sent
 * Everything is actionable inline (confirm/change/ignore) so the user never
 * needs the dashboard. It reads only the search/prompt box text and talks
 * only to the extension's own background worker; typing never records
 * anything.
 */

const MODE: "chat" | "search" = isChatHost(location.hostname) ? "chat" : "search";
const MIN_QUERY_LENGTH = 5;
const DISMISS_KEY = "loopback-dismissed";

let hostEl: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;
let current: LiveMatch | null = null;
let currentDismissKey = "";
let currentAnchored = true;
let expanded = false;
/** The chat composer (or search box) the user last typed in. */
let composerEl: HTMLElement | null = null;

const dismissed = new Set<string>(readDismissed());

function readDismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function rememberDismiss(key: string): void {
  dismissed.add(key);
  try {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...dismissed]));
  } catch {
    /* session storage unavailable — dismiss just won't persist across pages */
  }
}

const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .card {
    --surface: #ffffff;
    --border: #e5e5e5;
    --divider: #f0f0f0;
    --hover: #f5f5f5;
    --text: #171717;
    --secondary: #737373;
    --muted: #a3a3a3;
    --link: #1d4ed8;
    --green: #16a34a;
    --green-soft: #f0fdf4;
    --green-text: #14532d;
    --amber: #d97706;

    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.45;
    color: var(--text);
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 3px solid var(--amber);
    border-radius: 10px;
    padding: 12px 14px;
    max-width: 600px;
    position: relative;
    animation: searchback-enter 180ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  /* Matches the theme of the page the card sits on (Google dark mode). */
  .card.dark {
    --surface: #202124;
    --border: #3c4043;
    --divider: #303134;
    --hover: #303134;
    --text: #e8eaed;
    --secondary: #9aa0a6;
    --muted: #80868b;
    --link: #8ab4f8;
    --green: #81c995;
    --green-soft: rgba(129, 201, 149, 0.12);
    --green-text: #c7ecd1;
    --amber: #fdd663;
  }
  .card.solved { border-left-color: var(--green); }
  .card.floating {
    position: fixed;
    top: 76px;
    right: 20px;
    width: 380px;
    z-index: 2147483647;
  }
  /* On chat sites the card is positioned right above the composer via
     inline styles (measured from its bounding box); this is the fallback. */
  .card.floating.chat {
    top: auto;
    bottom: 110px;
    right: 12px;
    width: min(760px, calc(100vw - 24px));
    max-width: none;
    max-height: min(480px, calc(100vh - 120px));
    overflow: auto;
    overscroll-behavior: contain;
    border-left-width: 1px;
    border-radius: 16px;
    padding: 15px 16px 13px;
    scrollbar-width: thin;
  }
  .card.floating.chat.solved { border-color: var(--border); }
  .label.chatlink { color: var(--link); }
  .heading { display: flex; align-items: center; gap: 7px; padding-right: 32px; margin-bottom: 6px; }
  .brandmark { width: 17px; height: 17px; color: var(--text); flex: 0 0 auto; }
  .brandmark svg { display: block; width: 100%; height: 100%; }
  .kicker {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--amber);
    margin-bottom: 3px;
  }
  .chat .kicker {
    margin: 0;
    color: var(--secondary);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
  }
  .card.solved .kicker { color: var(--green); }
  .card.chat.solved .kicker { color: var(--secondary); }
  .titleline { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
  .title { font-size: 15px; font-weight: 650; }
  .meta { font-size: 12px; color: var(--muted); }
  .chat .titleline { margin-bottom: 11px; padding-right: 30px; }
  .chat .title { font-size: 16px; letter-spacing: -0.01em; }
  .note {
    background: var(--green-soft);
    border-radius: 7px;
    padding: 7px 10px;
    font-size: 13px;
    color: var(--green-text);
    margin-bottom: 8px;
    white-space: pre-wrap;
  }
  .row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .chat > .row {
    gap: 12px;
    margin-bottom: 8px;
    padding: 10px 11px;
    border: 1px solid var(--divider);
    border-radius: 11px;
    background: color-mix(in srgb, var(--hover) 48%, var(--surface));
  }
  .row-main { min-width: 0; flex: 1; }
  .label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .label.green { color: var(--green); }
  .label.amber { color: var(--amber); }
  .label .why {
    font-weight: 500;
    text-transform: none;
    letter-spacing: 0;
    color: var(--muted);
  }
  .pagerow { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .favicon {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .pagetext { min-width: 0; flex: 1; }
  .confirm-text { font-size: 13.5px; margin-bottom: 10px; }
  a.page {
    display: block;
    color: var(--link);
    text-decoration: none;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  a.page:hover { text-decoration: underline; }
  .domain { font-size: 12px; color: var(--muted); }
  .actions { display: flex; gap: 6px; flex-shrink: 0; }
  button {
    font: inherit;
    font-size: 12.5px;
    font-weight: 500;
    border-radius: 7px;
    padding: 4px 10px;
    cursor: pointer;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    white-space: nowrap;
    transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform 150ms ease;
  }
  button:hover { background: var(--hover); transform: translateY(-1px); }
  button:active { transform: translateY(0); }
  button:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
  button.green { border-color: var(--green); color: var(--green); }
  button.green:hover { background: var(--green-soft); }
  button.ghost { border-color: transparent; color: var(--secondary); }
  button.ghost:hover { background: var(--hover); }
  button.close {
    width: 28px;
    height: 28px;
    position: absolute;
    top: 7px;
    right: 8px;
    display: grid;
    place-items: center;
    border-color: transparent;
    border-radius: 50%;
    padding: 0;
    color: var(--secondary);
    font-size: 20px;
    font-weight: 400;
    line-height: 1;
  }
  button.close:hover { color: var(--text); background: var(--hover); }
  .card > .kicker { padding-right: 28px; }
  .footer { display: flex; gap: 4px; margin-top: 8px; }
  .chat .footer { margin-top: 4px; justify-content: space-between; }
  .divider { border-top: 1px solid var(--divider); margin: 8px 0; }
  @keyframes searchback-enter {
    from { opacity: 0; transform: translateY(8px) scale(0.99); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @media (max-width: 560px) {
    .card.floating.chat { border-radius: 13px; padding: 13px; }
    .chat > .row { align-items: stretch; flex-direction: column; }
    .chat .actions { align-self: flex-start; flex-wrap: wrap; }
    .chat .titleline { align-items: flex-start; flex-direction: column; gap: 1px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .card { animation: none; }
    button { transition: none; }
  }
`;

/**
 * Google's dark mode is a per-site setting, not always the OS theme, so the
 * page's real background color is the source of truth; the OS preference is
 * only the fallback when the background can't be read.
 */
function pageIsDark(): boolean {
  const bg = getComputedStyle(document.body).backgroundColor;
  const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) {
    const alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (alpha > 0.1) {
      const luminance = 0.299 * Number(m[1]) + 0.587 * Number(m[2]) + 0.114 * Number(m[3]);
      return luminance < 128;
    }
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function ensureCard(): HTMLDivElement {
  if (hostEl && shadow) return shadow.querySelector(".card") as HTMLDivElement;
  hostEl = document.createElement("div");
  hostEl.id = "loopback-host";
  shadow = hostEl.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = CSS;
  shadow.append(style);
  const card = document.createElement("div");
  card.className = "card";
  shadow.append(card);
  return card;
}

/**
 * Chat apps usually put the editable node inside a wider composer shell that
 * also contains upload, voice, and send controls. Anchor to that shell so the
 * reminder follows the full visual width of the text box, not just its text.
 */
function chatComposerRect(): DOMRect | null {
  if (!composerEl?.isConnected) return null;
  const own = composerEl.getBoundingClientRect();
  if (own.width <= 0) return null;

  const maxWidth = Math.min(window.innerWidth - 24, Math.max(own.width + 220, own.width * 1.45));
  const maxHeight = Math.max(260, own.height * 4 + 80);
  const candidates: HTMLElement[] = [composerEl];
  let ancestor = composerEl.parentElement;
  for (let depth = 0; ancestor && depth < 8; depth += 1, ancestor = ancestor.parentElement) {
    if (ancestor === document.body || ancestor === document.documentElement) break;
    candidates.push(ancestor);
  }

  const viable = candidates.filter((candidate) => {
    const rect = candidate.getBoundingClientRect();
    return (
      rect.width >= own.width &&
      rect.width <= maxWidth &&
      rect.height > 0 &&
      rect.height <= maxHeight &&
      Math.abs(rect.bottom - own.bottom) <= 96 &&
      rect.left >= -1 &&
      rect.right <= window.innerWidth + 1
    );
  });

  const form = composerEl.closest("form");
  if (form instanceof HTMLElement && viable.includes(form)) return form.getBoundingClientRect();
  return (viable.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)[0] ?? composerEl)
    .getBoundingClientRect();
}

function placeCard(anchored: boolean): void {
  if (!hostEl) return;
  const card = shadow!.querySelector(".card") as HTMLDivElement;
  const resultsAnchor = anchored
    ? document.querySelector("#search") ?? document.querySelector("#rso") ?? document.querySelector("#main")
    : null;
  if (resultsAnchor && resultsAnchor.parentElement) {
    card.classList.remove("floating");
    hostEl.style.cssText = "display:block;margin:0 0 20px 0;";
    if (hostEl.parentElement !== resultsAnchor.parentElement || hostEl.nextElementSibling !== resultsAnchor) {
      resultsAnchor.parentElement.insertBefore(hostEl, resultsAnchor);
    }
  } else {
    card.classList.add("floating");
    card.classList.toggle("chat", MODE === "chat");
    hostEl.style.cssText = "";
    if (hostEl.parentElement !== document.body) document.body.append(hostEl);
    // Chat mode: sit directly on top of the composer being typed in.
    if (MODE === "chat" && composerEl?.isConnected) {
      const rect = chatComposerRect();
      if (rect) {
        const width = Math.min(Math.max(rect.width, 320), window.innerWidth - 24);
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
        card.style.bottom = `${Math.max(window.innerHeight - rect.top + 10, 12)}px`;
        card.style.left = `${left}px`;
        card.style.right = "auto";
        card.style.width = `${width}px`;
        card.style.maxWidth = "calc(100vw - 24px)";
        card.style.maxHeight = `${Math.max(Math.min(rect.top - 16, 480), 180)}px`;
      }
    } else {
      card.style.cssText = "";
    }
  }
}

/** Keep the card glued to the composer as the layout moves. */
function repositionIfNeeded(): void {
  if (MODE === "chat" && hostEl?.isConnected) placeCard(false);
}
window.addEventListener("resize", repositionIfNeeded);
document.addEventListener("scroll", repositionIfNeeded, true);

function hideCard(): void {
  current = null;
  currentDismissKey = "";
  expanded = false;
  hostEl?.remove();
  hostEl = null;
  shadow = null;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(className: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", className, text);
  b.addEventListener("click", onClick);
  return b;
}

function pageBlock(page: LiveMatchPage): HTMLElement {
  const wrap = el("div", "pagerow");
  const iconSrc = faviconUrl(page.url);
  if (iconSrc) {
    const icon = el("img", "favicon") as HTMLImageElement;
    icon.src = iconSrc;
    icon.alt = "";
    icon.addEventListener("error", () => icon.remove());
    wrap.append(icon);
  }
  const text = el("div", "pagetext");
  const link = el("a", "page", page.title) as HTMLAnchorElement;
  link.href = page.url;
  link.rel = "noopener";
  text.append(link, el("div", "domain", page.domain));
  wrap.append(text);
  return wrap;
}

/** Section label, optionally with a lowercase explanation appended. */
function labelWithWhy(className: string, text: string, why?: string): HTMLElement {
  const label = el("div", className, text);
  if (why) {
    label.append(" · ");
    label.append(el("span", "why", why));
  }
  return label;
}

function brandMark(): HTMLElement {
  const mark = el("span", "brandmark");
  mark.setAttribute("aria-hidden", "true");
  mark.innerHTML = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15.8 7.4A6.25 6.25 0 1 0 16.2 11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12.8 4.7 16.2 7.4l-4.1 1" fill="currentColor"/></svg>`;
  return mark;
}

function send(message: Record<string, unknown>): void {
  try {
    chrome.runtime.sendMessage(message, () => void chrome.runtime.lastError);
  } catch {
    /* extension was reloaded — the next page load recovers */
  }
}

/** Confirm a page as the solution and update the card in place. */
function confirmSolution(page: LiveMatchPage): void {
  if (!current) return;
  send({ type: "loopback:solve", clusterId: current.clusterId, pageId: page.pageId });
  const previous = current.solution;
  current.status = "solved";
  current.solution = page;
  current.candidates = [
    ...(previous ? [previous] : []),
    ...current.candidates.filter((c) => c.pageId !== page.pageId),
  ];
  if (current.lastChat?.pageId === page.pageId) current.lastChat = undefined;
  expanded = false;
  render();
}

function render(): void {
  if (!current) return;
  const match = current;
  const card = ensureCard();
  card.textContent = "";

  const closeButton = button("close", "×", () => {
    if (currentDismissKey) rememberDismiss(currentDismissKey);
    hideCard();
  });
  closeButton.setAttribute("aria-label", "Dismiss for this search");
  closeButton.title = "Dismiss for this search";
  card.append(closeButton);

  const hasSolution = Boolean(match.solution) || Boolean(match.note);
  card.classList.toggle("solved", hasSolution);
  card.classList.toggle("dark", pageIsDark());

  const kickerText = MODE === "chat"
    ? hasSolution
      ? "Searchback found your previous solution"
      : "Searchback found related research"
    : hasSolution
      ? "You solved this before"
      : "You searched for this before";
  const kicker = el("div", "kicker", kickerText);
  if (MODE === "chat") {
    const heading = el("div", "heading");
    heading.append(brandMark(), kicker);
    card.append(heading);
  } else {
    card.append(kicker);
  }
  const titleline = el("div", "titleline");
  const searchesLabel = `${match.searchCount} ${match.searchCount === 1 ? "search" : "searches"}`;
  const daysLabel = `${match.dayCount} ${match.dayCount === 1 ? "day" : "days"}`;
  titleline.append(el("div", "title", match.title), el("div", "meta", `${searchesLabel} · ${daysLabel}`));
  card.append(titleline);

  if (match.note) card.append(el("div", "note", match.note));

  if (match.solution) {
    const row = el("div", "row");
    const main = el("div", "row-main");
    main.append(labelWithWhy("label green", "Your solution"), pageBlock(match.solution));
    row.append(main);
    const actions = el("div", "actions");
    actions.append(
      button("ghost", expanded ? "Hide" : "Change", () => {
        expanded = !expanded;
        render();
      }),
    );
    row.append(actions);
    card.append(row);
  } else if (match.candidates.length > 0) {
    // No configuration needed: best guess is shown automatically, with the
    // behavioral signal that put it on top.
    const [likely] = match.candidates;
    const row = el("div", "row");
    const main = el("div", "row-main");
    main.append(labelWithWhy("label amber", "Likely solution", likely.reason), pageBlock(likely));
    row.append(main);
    const actions = el("div", "actions");
    actions.append(button("green", "✓ This solved it", () => confirmSolution(likely)));
    if (match.candidates.length > 1) {
      actions.append(
        button("ghost", expanded ? "Less" : "More", () => {
          expanded = !expanded;
          render();
        }),
      );
    }
    row.append(actions);
    card.append(row);
  }

  // When research ENDED in an AI conversation and produced no article
  // candidates, the chat itself is the best guess at where it got solved.
  const chatIsLikely = !match.solution && match.candidates.length === 0 && Boolean(match.lastChat);
  if (chatIsLikely && match.lastChat) {
    const likelyChat = match.lastChat;
    const row = el("div", "row");
    const main = el("div", "row-main");
    main.append(
      labelWithWhy("label amber", "Likely solved in this chat", "your research ended here"),
      pageBlock(likelyChat),
    );
    row.append(main);
    const actions = el("div", "actions");
    actions.append(button("green", "✓ This solved it", () => confirmSolution(likelyChat)));
    row.append(actions);
    card.append(row);
  } else if (match.lastChat) {
    const row = el("div", "row");
    const main = el("div", "row-main");
    main.append(labelWithWhy("label chatlink", "Your last chat about this"), pageBlock(match.lastChat));
    row.append(main);
    card.append(row);
  }

  if (expanded) {
    card.append(el("div", "divider", ""));
    const rest = match.solution ? match.candidates : match.candidates.slice(1);
    for (const candidate of rest.slice(0, 4)) {
      const row = el("div", "row");
      row.append(pageBlock(candidate));
      const actions = el("div", "actions");
      actions.append(button("green", "✓ This one", () => confirmSolution(candidate)));
      row.append(actions);
      card.append(row);
    }
    const escape = el("div", "row");
    if (match.solution) {
      escape.append(
        button("ghost", "Remove solution", () => {
          send({ type: "loopback:unsolve", clusterId: match.clusterId });
          if (match.solution) match.candidates = [match.solution, ...match.candidates];
          match.solution = undefined;
          match.status = "unresolved";
          expanded = false;
          render();
        }),
      );
    }
    escape.append(
      button("ghost", "Not here — see all research", () =>
        send({ type: "loopback:open-problem", clusterId: match.clusterId }),
      ),
    );
    card.append(escape);
  }

  const footer = el("div", "footer");
  footer.append(
    button("ghost", "View all", () => send({ type: "loopback:open-problem", clusterId: match.clusterId })),
    button("ghost", "Don't remind me", () => {
      const previousStatus = match.status;
      send({ type: "loopback:ignore", clusterId: match.clusterId });
      renderIgnoredConfirmation(previousStatus);
    }),
  );
  card.append(footer);

  placeCard(currentAnchored);
}

/**
 * Shown right after "Don't remind me", so the card doesn't just vanish and
 * leave the user wondering what happened — and gives them a way back.
 */
function renderIgnoredConfirmation(previousStatus: LiveMatch["status"]): void {
  if (!current) return;
  const match = current;
  const card = ensureCard();
  card.textContent = "";
  card.classList.remove("solved");
  card.append(
    el("div", "kicker", "Searchback"),
    el("div", "confirm-text", "Done. Searchback won't remind you about this problem again."),
  );
  const actions = el("div", "actions");
  actions.append(
    button("", "Undo", () => {
      send({ type: "loopback:set-status", clusterId: match.clusterId, status: previousStatus });
      match.status = previousStatus;
      render();
    }),
    button("ghost", "Close", () => hideCard()),
  );
  card.append(actions);
  placeCard(currentAnchored);
}

function requestMatch(query: string): Promise<LiveMatch | null> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "loopback:match", query, url: location.href }, (response) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(response?.match ?? null);
      });
    } catch {
      resolve(null);
    }
  });
}

async function refresh(query: string | null, anchored: boolean): Promise<void> {
  if (!query || query.trim().length < MIN_QUERY_LENGTH) {
    hideCard();
    return;
  }
  const match = await requestMatch(query);
  const key = match ? reminderDismissKey(match.clusterId, query) : "";
  if (!match || dismissed.has(key)) {
    hideCard();
    return;
  }
  // Avoid re-rendering the same card on every keystroke.
  if (current?.clusterId === match.clusterId && currentDismissKey === key && hostEl?.isConnected) return;
  current = match;
  currentDismissKey = key;
  currentAnchored = anchored;
  expanded = false;
  render();
}

function currentSearchQuery(): string | null {
  if (location.pathname !== "/search") return null;
  return new URLSearchParams(location.search).get("q");
}

/**
 * Pulls the text being typed out of whatever the site uses as its input:
 * Google's `q` box in search mode; the prompt composer (a textarea on some
 * sites, a contenteditable on ChatGPT/Claude/Gemini) in chat mode.
 */
function typedTextFrom(target: EventTarget | null): string | null {
  if (MODE === "search") {
    if (
      (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
      target.getAttribute("name") === "q"
    ) {
      return target.value;
    }
    return null;
  }
  if (target instanceof HTMLTextAreaElement) {
    composerEl = target;
    return target.value;
  }
  if (target instanceof HTMLElement && target.isContentEditable) {
    composerEl = target;
    return target.innerText;
  }
  return null;
}

// ---- Detecting that a prompt was actually SENT to the chatbot ----
// Two signals: Enter (without shift) in the composer, and the composer
// suddenly clearing right after having real text (covers send buttons).
// The conversation URL is read a moment later because chat SPAs assign the
// permalink (chatgpt.com/c/…, claude.ai/chat/…) only after sending.
let lastTypedPrompt = "";
let lastTypedAt = 0;
let lastQueuedPrompt = "";
let lastQueuedAt = 0;

function trackPossibleSend(value: string): void {
  const trimmed = value.trim();
  const now = Date.now();
  if (trimmed.length >= MIN_QUERY_LENGTH) {
    lastTypedPrompt = trimmed;
    lastTypedAt = now;
  } else if (trimmed.length === 0 && lastTypedPrompt && now - lastTypedAt < 15_000) {
    queuePromptAsked(lastTypedPrompt);
    lastTypedPrompt = "";
  }
}

function queuePromptAsked(prompt: string): void {
  const now = Date.now();
  if (prompt === lastQueuedPrompt && now - lastQueuedAt < 10_000) return;
  lastQueuedPrompt = prompt;
  lastQueuedAt = now;
  setTimeout(() => {
    send({ type: "loopback:chat-asked", prompt, url: location.href, title: document.title });
  }, 2500);
}

document.addEventListener(
  "keydown",
  (event) => {
    if (MODE !== "chat" || event.key !== "Enter" || event.shiftKey) return;
    const text = typedTextFrom(event.target);
    if (text && text.trim().length >= MIN_QUERY_LENGTH) queuePromptAsked(text.trim());
  },
  true,
);

// 1) Google results page: show the card anchored above the results.
void refresh(currentSearchQuery(), true);

// 2) Live typing — the Google search box, or an AI chat composer — before
//    the user hits enter / sends the prompt.
let debounce: ReturnType<typeof setTimeout> | undefined;
document.addEventListener(
  "input",
  (event) => {
    const value = typedTextFrom(event.target);
    if (value === null) return;
    if (MODE === "chat") trackPossibleSend(value);
    clearTimeout(debounce);
    debounce = setTimeout(
      () => void refresh(value, MODE === "search" && currentSearchQuery() !== null),
      MODE === "chat" ? 350 : 250,
    );
  },
  true,
);

// 3) Google sometimes swaps results via pushState instead of a full load.
let lastHref = location.href;
setInterval(() => {
  if (location.href === lastHref) return;
  lastHref = location.href;
  current = null;
  void refresh(currentSearchQuery(), true);
}, 1000);
