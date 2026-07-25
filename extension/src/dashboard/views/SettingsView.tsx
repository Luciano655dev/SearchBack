import { useRef, useState } from "react";
import type { SearchbackConfig } from "../../core/types";
import { CHAT_SITES } from "../../core/chatHosts";
import { repository } from "../../storage/repository";

type SettingsViewProps = {
  initialConfig: SearchbackConfig;
  onChanged: () => void;
};

export function SettingsView({ initialConfig, onChanged }: SettingsViewProps) {
  const [config, setConfig] = useState(initialConfig);
  const saveQueue = useRef(Promise.resolve());
  const disabledChatbotCount = CHAT_SITES.filter((site) =>
    site.hosts.some((host) => config.blockedReminderHosts.includes(host)),
  ).length;

  const save = (patch: Partial<SearchbackConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
    saveQueue.current = saveQueue.current.then(async () => {
      await repository.updateConfig(patch);
      onChanged();
    });
    return saveQueue.current;
  };

  const setSiteEnabled = (hosts: readonly string[], enabled: boolean) => {
    const blocked = new Set(config.blockedReminderHosts);
    for (const host of hosts) {
      if (enabled) blocked.delete(host);
      else blocked.add(host);
    }
    void save({ blockedReminderHosts: [...blocked].sort() });
  };

  return (
    <div className="page settings-page">
      <a className="back-link" href="#/">← Back to dashboard</a>
      <h1>Reminder settings</h1>
      <p className="page-sub">Choose where Searchback can bring previous research back.</p>

      <section className="settings-group">
        <h2>Availability</h2>
        <SettingToggle
          label="Show reminders"
          description="Turn this off to never show Searchback on any site. Your saved research stays intact."
          checked={config.remindersEnabled}
          onChange={(checked) => save({ remindersEnabled: checked })}
        />
      </section>

      <section className={`settings-group${config.remindersEnabled ? "" : " is-disabled"}`}>
        <h2>Surfaces</h2>
        <SettingToggle
          label="Google Search"
          description="Show previous research while typing and beside matching search results."
          checked={config.showOnGoogle}
          disabled={!config.remindersEnabled}
          onChange={(checked) => save({ showOnGoogle: checked })}
        />
        <SettingToggle
          label="AI chatbots"
          description="Show reminders above supported chatbot composers before you send a prompt."
          checked={config.showOnChatbots}
          disabled={!config.remindersEnabled}
          onChange={(checked) => save({ showOnChatbots: checked })}
        />
      </section>

      <section
        className={`settings-group${config.remindersEnabled && config.showOnChatbots ? "" : " is-disabled"}`}
      >
        <div className="settings-heading-row">
          <div>
            <h2>Chatbot sites</h2>
            <p>Disable individual sites without turning off chatbot reminders everywhere.</p>
          </div>
          <span>
            {disabledChatbotCount === 0
              ? "All enabled"
              : `${disabledChatbotCount} blocked`}
          </span>
        </div>
        <div className="site-settings-grid">
          {CHAT_SITES.map((site) => {
            const enabled = site.hosts.every((host) => !config.blockedReminderHosts.includes(host));
            return (
              <SettingToggle
                key={site.id}
                label={site.label}
                description={site.hosts[0]}
                checked={enabled}
                compact
                disabled={!config.remindersEnabled || !config.showOnChatbots}
                onChange={(checked) => setSiteEnabled(site.hosts, checked)}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

type SettingToggleProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
};

function SettingToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  compact = false,
}: SettingToggleProps) {
  return (
    <label className={`setting-toggle${compact ? " compact" : ""}`}>
      <span className="setting-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch-track" aria-hidden="true"><span /></span>
    </label>
  );
}
