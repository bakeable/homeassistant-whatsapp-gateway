import Editor from "@monaco-editor/react";
import yaml from "js-yaml";
import { useCallback, useEffect, useState } from "react";
import { haApi, rulesApi, waApi } from "../api";

/** All Evolution API event types (keep in sync with engine/types.ts) */
const EVOLUTION_EVENTS = [
  "MESSAGES_UPSERT",
  "MESSAGES_UPDATE",
  "MESSAGES_DELETE",
  "SEND_MESSAGE",
  "CONNECTION_UPDATE",
  "CONTACTS_UPDATE",
  "CONTACTS_UPSERT",
  "GROUPS_UPSERT",
  "GROUPS_UPDATE",
  "GROUP_PARTICIPANTS_UPDATE",
  "PRESENCE_UPDATE",
  "CHATS_UPSERT",
  "CHATS_UPDATE",
  "CHATS_DELETE",
  "CALL",
  "QRCODE_UPDATED",
  "TYPEBOT_START",
  "TYPEBOT_CHANGE_STATUS",
  "LABELS_EDIT",
  "LABELS_ASSOCIATION",
] as const;

/** Human-friendly labels for event types */
const EVENT_LABELS: Record<string, string> = {
  MESSAGES_UPSERT: "💬 Message received",
  MESSAGES_UPDATE: "✏️ Message updated",
  MESSAGES_DELETE: "🗑️ Message deleted",
  SEND_MESSAGE: "📤 Message sent",
  CONNECTION_UPDATE: "🔗 Connection status",
  CONTACTS_UPDATE: "📇 Contact updated",
  CONTACTS_UPSERT: "📇 Contact added/updated",
  GROUPS_UPSERT: "👥 Group created/updated",
  GROUPS_UPDATE: "👥 Group updated",
  GROUP_PARTICIPANTS_UPDATE: "👤 Group member change",
  PRESENCE_UPDATE: "🟢 Presence (online/offline)",
  CHATS_UPSERT: "💬 Chat created/updated",
  CHATS_UPDATE: "💬 Chat updated",
  CHATS_DELETE: "🗑️ Chat deleted",
  CALL: "📞 Call",
  QRCODE_UPDATED: "📱 QR code updated",
  TYPEBOT_START: "🤖 Typebot started",
  TYPEBOT_CHANGE_STATUS: "🤖 Typebot status change",
  LABELS_EDIT: "🏷️ Label edited",
  LABELS_ASSOCIATION: "🏷️ Label associated",
};

type TextMatchMode = "contains" | "starts_with" | "regex";

interface ValidationError {
  path: string;
  message: string;
  line?: number;
}

interface HAEntity {
  entity_id: string;
  name: string;
  icon?: string;
}

interface Chat {
  chat_id: string;
  name: string;
  type: "group" | "direct";
}

const DEFAULT_RULES = `version: 1
rules:
  # Example rule - customize or delete this
  - id: example_goodnight
    name: Goodnight Routine Example
    enabled: false
    priority: 100
    stop_on_match: true
    match:
      events:
        - MESSAGES_UPSERT
      chat:
        type: direct  # direct, group, or any
      text:
        mode: contains
        patterns:
          - "goodnight"
          - "welterusten"
    actions:
      - type: ha_service
        service: script.turn_on
        target:
          entity_id: script.goodnight_routine
      - type: reply_whatsapp
        text: "✅ Goodnight routine started!"
    cooldown_seconds: 60
`;

export default function RulesPage() {
  const [yamlContent, setYamlContent] = useState("");
  const [originalYaml, setOriginalYaml] = useState("");
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  );
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [view, setView] = useState<"yaml" | "builder">("yaml");

  // For guided builder
  const [scripts, setScripts] = useState<HAEntity[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [testMessage, setTestMessage] = useState({
    chat_id: "",
    sender_id: "",
    text: "",
  });
  const [testResult, setTestResult] = useState<any>(null);

  // Load rules and entities
  useEffect(() => {
    loadRules();
    loadEntities();
  }, []);

  // Track changes
  useEffect(() => {
    setHasChanges(yamlContent !== originalYaml);
  }, [yamlContent, originalYaml]);

  const loadRules = async () => {
    try {
      const data = await rulesApi.getRules();
      const yaml = data.yaml || DEFAULT_RULES;
      setYamlContent(yaml);
      setOriginalYaml(yaml);
    } catch (e) {
      console.error("Failed to load rules:", e);
      setYamlContent(DEFAULT_RULES);
      setOriginalYaml(DEFAULT_RULES);
    }
  };

  const loadEntities = async () => {
    try {
      const [scriptsData, chatsData] = await Promise.all([
        haApi.getScripts(),
        waApi.getChats({ enabled: true }),
      ]);
      setScripts(scriptsData);
      setChats(chatsData);
    } catch (e) {
      console.error("Failed to load entities:", e);
    }
  };

  // Validate YAML
  const validateYaml = useCallback(async (content: string) => {
    setValidating(true);
    try {
      const result = await rulesApi.validate(content);
      setValidationErrors(result.errors || []);
    } catch (e: any) {
      setValidationErrors([{ path: "", message: e.message }]);
    } finally {
      setValidating(false);
    }
  }, []);

  // Debounced validation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (yamlContent) {
        validateYaml(yamlContent);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [yamlContent, validateYaml]);

  // Save rules
  const handleSave = async () => {
    setSaving(true);
    try {
      await rulesApi.saveRules(yamlContent);
      setOriginalYaml(yamlContent);
      setHasChanges(false);
      alert("Rules saved successfully!");
    } catch (e: any) {
      alert(`Failed to save: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Test rules
  const handleTest = async () => {
    try {
      const result = await rulesApi.test(testMessage);
      setTestResult(result);
    } catch (e: any) {
      alert(`Test failed: ${e.message}`);
    }
  };

  // Add rule from builder
  const addRuleFromBuilder = (rule: any) => {
    try {
      const current = yaml.load(yamlContent) as any;
      current.rules = current.rules || [];
      current.rules.push(rule);
      setYamlContent(yaml.dump(current, { indent: 2 }));
      setView("yaml");
    } catch (e) {
      alert("Failed to add rule to YAML");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-mushroom-text">Rules</h2>
        <div className="flex items-center space-x-2">
          <div className="flex rounded-mushroom overflow-hidden border border-mushroom-border">
            <button
              onClick={() => setView("yaml")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "yaml"
                  ? "bg-primary text-white"
                  : "bg-mushroom-card text-mushroom-text-secondary hover:bg-mushroom-card-hover"
              }`}
            >
              📝 YAML Editor
            </button>
            <button
              onClick={() => setView("builder")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                view === "builder"
                  ? "bg-primary text-white"
                  : "bg-mushroom-card text-mushroom-text-secondary hover:bg-mushroom-card-hover"
              }`}
            >
              🔧 Guided Builder
            </button>
          </div>
          {view === "yaml" && (
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges || validationErrors.length > 0}
              className="btn btn-success"
            >
              {saving ? "Saving..." : hasChanges ? "💾 Save Rules" : "✓ Saved"}
            </button>
          )}
        </div>
      </div>

      {view === "yaml" ? (
        <div className="space-y-4">
          {/* Validation Status */}
          <div className="flex items-center space-x-4">
            <span className="text-sm text-mushroom-text-secondary">
              {validating
                ? "⏳ Validating..."
                : validationErrors.length === 0
                  ? "✅ Valid YAML"
                  : `❌ ${validationErrors.length} error(s)`}
            </span>
            {hasChanges && (
              <span className="text-sm text-warning-text">
                ● Unsaved changes
              </span>
            )}
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="p-4 bg-danger-muted border border-danger/30 rounded-mushroom">
              <h4 className="font-medium text-danger-text mb-2">
                Validation Errors:
              </h4>
              <ul className="text-sm text-danger-text/80 space-y-1">
                {validationErrors.map((err, i) => (
                  <li key={i}>
                    {err.path && (
                      <code className="bg-danger/20 px-1 rounded">
                        {err.path}
                      </code>
                    )}
                    {err.path && ": "}
                    {err.message}
                    {err.line && (
                      <span className="text-danger-text/60">
                        {" "}
                        (line {err.line})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Monaco Editor */}
          <div className="monaco-container h-[500px]">
            <Editor
              height="100%"
              defaultLanguage="yaml"
              value={yamlContent}
              onChange={(value) => setYamlContent(value || "")}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                wordWrap: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>

          {/* Test Panel */}
          <div className="card">
            <h3 className="font-medium text-mushroom-text mb-3">
              🧪 Test Rules
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="label">Chat ID</label>
                <select
                  value={testMessage.chat_id}
                  onChange={(e) =>
                    setTestMessage({ ...testMessage, chat_id: e.target.value })
                  }
                  className="input"
                >
                  <option value="">Select a chat...</option>
                  {chats.map((chat) => (
                    <option key={chat.chat_id} value={chat.chat_id}>
                      {chat.name} ({chat.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Sender ID</label>
                <input
                  type="text"
                  value={testMessage.sender_id}
                  onChange={(e) =>
                    setTestMessage({
                      ...testMessage,
                      sender_id: e.target.value,
                    })
                  }
                  className="input"
                  placeholder="e.g., 31612345678"
                />
              </div>
              <div>
                <label className="label">Message Text</label>
                <input
                  type="text"
                  value={testMessage.text}
                  onChange={(e) =>
                    setTestMessage({ ...testMessage, text: e.target.value })
                  }
                  className="input"
                  placeholder="e.g., goodnight"
                />
              </div>
            </div>
            <button
              onClick={handleTest}
              className="btn btn-primary"
              disabled={!testMessage.text}
            >
              Run Test
            </button>

            {testResult && (
              <div className="mt-3 p-4 bg-mushroom-bg-secondary rounded-mushroom">
                <h4 className="font-medium text-mushroom-text mb-2">
                  {testResult.matched_rules.length > 0
                    ? "✅ Matched Rules:"
                    : "❌ No rules matched"}
                </h4>
                {testResult.matched_rules.map((rule: any) => (
                  <div
                    key={rule.id}
                    className="text-sm mb-2 text-mushroom-text"
                  >
                    <strong>{rule.name}</strong> ({rule.id})
                    <span className="text-mushroom-text-muted ml-2">
                      — {rule.reason}
                    </span>
                  </div>
                ))}
                {testResult.actions_preview.length > 0 && (
                  <>
                    <h4 className="font-medium text-mushroom-text mt-3 mb-2">
                      Actions that would execute:
                    </h4>
                    {testResult.actions_preview.map(
                      (action: any, i: number) => (
                        <div
                          key={i}
                          className="text-sm text-mushroom-text-secondary"
                        >
                          • {action.details}
                        </div>
                      ),
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <GuidedBuilder
          scripts={scripts}
          chats={chats}
          onAddRule={addRuleFromBuilder}
        />
      )}
    </div>
  );
}

// Guided Builder Component
function GuidedBuilder({
  scripts,
  chats,
  onAddRule,
}: {
  scripts: HAEntity[];
  chats: Chat[];
  onAddRule: (rule: any) => void;
}) {
  const [rule, setRule] = useState({
    id: "",
    name: "",
    enabled: true,
    priority: 100,
    stop_on_match: true,
    cooldown_seconds: 0,
    match: {
      events: ["MESSAGES_UPSERT"] as string[],
      chat: { type: "any" as const, ids: [] as string[] },
      sender: { ids: [] as string[], numbers: [] as string[] },
      text: { mode: "contains" as TextMatchMode, patterns: [] as string[] },
    },
    actions: [] as any[],
  });
  const [patternInput, setPatternInput] = useState("");
  const [senderIdInput, setSenderIdInput] = useState("");
  const [senderInput, setSenderInput] = useState("");
  const [preview, setPreview] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [serviceDetails, setServiceDetails] = useState<Record<number, any>>({});

  // Auto-generate ID from name
  const generateId = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  // Update preview — clean up empty fields so the YAML stays readable
  useEffect(() => {
    const cleanRule: any = JSON.parse(JSON.stringify(rule));
    // events
    if (!cleanRule.match?.events?.length) delete cleanRule.match.events;
    // chat
    if (cleanRule.match?.chat?.ids?.length === 0)
      delete cleanRule.match.chat.ids;
    if (cleanRule.match?.chat?.type === "any" && !cleanRule.match?.chat?.ids)
      delete cleanRule.match.chat;
    // sender
    if (!cleanRule.match?.sender?.ids?.length)
      delete cleanRule.match?.sender?.ids;
    if (!cleanRule.match?.sender?.numbers?.length)
      delete cleanRule.match?.sender?.numbers;
    if (
      cleanRule.match?.sender &&
      !cleanRule.match.sender.ids &&
      !cleanRule.match.sender.numbers
    )
      delete cleanRule.match.sender;
    // text
    if (!cleanRule.match?.text?.patterns?.length) delete cleanRule.match.text;
    // empty match
    if (cleanRule.match && Object.keys(cleanRule.match).length === 0)
      delete cleanRule.match;
    if (!cleanRule.cooldown_seconds) delete cleanRule.cooldown_seconds;
    setPreview(yaml.dump(cleanRule, { indent: 2 }));
  }, [rule]);

  // --- helpers ---
  const addPattern = () => {
    if (patternInput.trim()) {
      setRule({
        ...rule,
        match: {
          ...rule.match,
          text: {
            ...rule.match.text,
            patterns: [...rule.match.text.patterns, patternInput.trim()],
          },
        },
      });
      setPatternInput("");
    }
  };

  const removePattern = (index: number) => {
    setRule({
      ...rule,
      match: {
        ...rule.match,
        text: {
          ...rule.match.text,
          patterns: rule.match.text.patterns.filter((_, i) => i !== index),
        },
      },
    });
  };

  const addSenderId = () => {
    const val = senderIdInput.trim();
    if (val) {
      setRule({
        ...rule,
        match: {
          ...rule.match,
          sender: {
            ...rule.match.sender,
            ids: [...rule.match.sender.ids, val],
          },
        },
      });
      setSenderIdInput("");
    }
  };

  const removeSenderId = (index: number) => {
    setRule({
      ...rule,
      match: {
        ...rule.match,
        sender: {
          ...rule.match.sender,
          ids: rule.match.sender.ids.filter((_, i) => i !== index),
        },
      },
    });
  };

  const addSenderNumber = () => {
    const cleaned = senderInput.trim().replace(/[^0-9+]/g, "");
    if (cleaned) {
      setRule({
        ...rule,
        match: {
          ...rule.match,
          sender: {
            ...rule.match.sender,
            numbers: [...rule.match.sender.numbers, cleaned],
          },
        },
      });
      setSenderInput("");
    }
  };

  const removeSenderNumber = (index: number) => {
    setRule({
      ...rule,
      match: {
        ...rule.match,
        sender: {
          ...rule.match.sender,
          numbers: rule.match.sender.numbers.filter((_, i) => i !== index),
        },
      },
    });
  };

  const toggleEvent = (eventType: string) => {
    const current = rule.match.events;
    const updated = current.includes(eventType)
      ? current.filter((e) => e !== eventType)
      : [...current, eventType];
    setRule({
      ...rule,
      match: { ...rule.match, events: updated },
    });
  };

  const loadServiceDetails = async (index: number, service: string) => {
    try {
      const details = await haApi.getServiceDetails(service);
      setServiceDetails((prev) => ({ ...prev, [index]: details }));
    } catch (e) {
      console.error("Failed to load service details:", e);
      setServiceDetails((prev) => ({ ...prev, [index]: null }));
    }
  };

  const addAction = (type: "ha_service" | "reply_whatsapp") => {
    if (type === "ha_service") {
      const newAction = {
        type,
        service: "script.turn_on",
        target: { entity_id: "" },
        data: {},
      };
      setRule({
        ...rule,
        actions: [...rule.actions, newAction],
      });
      loadServiceDetails(rule.actions.length, "script.turn_on");
    } else {
      setRule({
        ...rule,
        actions: [...rule.actions, { type, text: "" }],
      });
    }
  };

  const updateAction = (index: number, updates: any) => {
    setRule({
      ...rule,
      actions: rule.actions.map((a, i) =>
        i === index ? { ...a, ...updates } : a,
      ),
    });
    if (updates.service && rule.actions[index]?.type === "ha_service") {
      loadServiceDetails(index, updates.service);
    }
  };

  const removeAction = (index: number) => {
    setRule({ ...rule, actions: rule.actions.filter((_, i) => i !== index) });
  };

  const handleAdd = () => {
    if (!rule.id || !rule.name || rule.actions.length === 0) {
      alert("Please fill in rule name and at least one action");
      return;
    }
    onAddRule(rule);
  };

  // Determine if text matching section is relevant
  const hasTextEvents = rule.match.events.some((e) =>
    ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE"].includes(e),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="space-y-4">
        {/* Basic Info */}
        <div className="card">
          <h3 className="font-medium text-mushroom-text mb-3">Basic Info</h3>
          <div className="space-y-3">
            <div>
              <label className="label">Rule Name *</label>
              <input
                type="text"
                value={rule.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const id = generateId(name);
                  setRule({ ...rule, name, id });
                }}
                className="input"
                placeholder="e.g., Goodnight Routine"
              />
              <p className="text-xs text-mushroom-text-muted mt-1">
                ID: {rule.id || "(auto-generated)"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Priority</label>
                <input
                  type="number"
                  value={rule.priority}
                  onChange={(e) =>
                    setRule({
                      ...rule,
                      priority: parseInt(e.target.value) || 100,
                    })
                  }
                  className="input"
                />
              </div>
              <div>
                <label className="label">Cooldown (seconds)</label>
                <input
                  type="number"
                  value={rule.cooldown_seconds}
                  onChange={(e) =>
                    setRule({
                      ...rule,
                      cooldown_seconds: parseInt(e.target.value) || 0,
                    })
                  }
                  className="input"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4 mt-3">
            <label className="flex items-center space-x-2 text-mushroom-text-secondary">
              <input
                type="checkbox"
                checked={rule.enabled}
                onChange={(e) =>
                  setRule({ ...rule, enabled: e.target.checked })
                }
                className="rounded bg-mushroom-bg border-mushroom-border text-primary focus:ring-primary/30"
              />
              <span>Enabled</span>
            </label>
            <label className="flex items-center space-x-2 text-mushroom-text-secondary">
              <input
                type="checkbox"
                checked={rule.stop_on_match}
                onChange={(e) =>
                  setRule({ ...rule, stop_on_match: e.target.checked })
                }
                className="rounded bg-mushroom-bg border-mushroom-border text-primary focus:ring-primary/30"
              />
              <span>Stop on match</span>
            </label>
          </div>
        </div>

        {/* Event Selection */}
        <div className="card">
          <h3 className="font-medium text-mushroom-text mb-3">
            📡 Trigger Events
          </h3>
          <p className="text-xs text-mushroom-text-muted mb-2">
            Select which Evolution API events trigger this rule. Default:
            Message received.
          </p>
          <input
            type="text"
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            className="input mb-2"
            placeholder="Search events..."
          />
          <div className="max-h-56 overflow-y-auto space-y-0.5 bg-mushroom-bg rounded-mushroom p-2">
            {EVOLUTION_EVENTS.filter(
              (ev) =>
                ev.toLowerCase().includes(eventSearch.toLowerCase()) ||
                (EVENT_LABELS[ev] || "")
                  .toLowerCase()
                  .includes(eventSearch.toLowerCase()),
            ).map((ev) => (
              <label
                key={ev}
                className="flex items-center space-x-2 px-2 py-1.5 hover:bg-mushroom-card rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={rule.match.events.includes(ev)}
                  onChange={() => toggleEvent(ev)}
                  className="rounded border-mushroom-border"
                />
                <span className="text-sm text-mushroom-text">
                  {EVENT_LABELS[ev] || ev}
                </span>
                <span className="text-xs text-mushroom-text-muted ml-auto font-mono">
                  {ev}
                </span>
              </label>
            ))}
          </div>
          {rule.match.events.length > 0 && (
            <p className="text-xs text-mushroom-text-muted mt-2">
              {rule.match.events.length} event(s) selected
            </p>
          )}
        </div>

        {/* Match Conditions */}
        <div className="card">
          <h3 className="font-medium text-mushroom-text mb-3">
            🎯 Match Conditions
          </h3>
          <div className="space-y-4">
            {/* Chat type */}
            <div>
              <label className="label">Chat Type</label>
              <select
                value={rule.match.chat.type}
                onChange={(e) =>
                  setRule({
                    ...rule,
                    match: {
                      ...rule.match,
                      chat: { ...rule.match.chat, type: e.target.value as any },
                    },
                  })
                }
                className="input"
              >
                <option value="any">Any</option>
                <option value="direct">Direct Messages</option>
                <option value="group">Groups</option>
              </select>
            </div>

            {/* Specific Chats */}
            <div>
              <label className="label">Specific Chats (optional)</label>
              <input
                type="text"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                className="input mb-2"
                placeholder="Search chats..."
              />
              <div className="max-h-48 overflow-y-auto space-y-1 bg-mushroom-bg rounded-mushroom p-2">
                {chats
                  .filter(
                    (chat) =>
                      chat.name
                        .toLowerCase()
                        .includes(chatSearch.toLowerCase()) ||
                      chat.chat_id
                        .toLowerCase()
                        .includes(chatSearch.toLowerCase()),
                  )
                  .map((chat) => (
                    <label
                      key={chat.chat_id}
                      className="flex items-center space-x-2 p-2 hover:bg-mushroom-card rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={rule.match.chat.ids.includes(chat.chat_id)}
                        onChange={(e) => {
                          const ids = e.target.checked
                            ? [...rule.match.chat.ids, chat.chat_id]
                            : rule.match.chat.ids.filter(
                                (id) => id !== chat.chat_id,
                              );
                          setRule({
                            ...rule,
                            match: {
                              ...rule.match,
                              chat: { ...rule.match.chat, ids },
                            },
                          });
                        }}
                        className="rounded border-mushroom-border"
                      />
                      <span className="text-sm text-mushroom-text">
                        {chat.type === "group" ? "👥" : "👤"} {chat.name}
                      </span>
                    </label>
                  ))}
              </div>
              {rule.match.chat.ids.length > 0 && (
                <p className="text-xs text-mushroom-text-muted mt-2">
                  {rule.match.chat.ids.length} chat(s) selected
                </p>
              )}
            </div>

            {/* Sender filters */}
            <div>
              <label className="label">
                Sender / Contact Filters (optional)
              </label>
              <p className="text-xs text-mushroom-text-muted mb-2">
                Filter by exact chat IDs (JIDs) and/or phone numbers. Both are
                AND — if you specify both, both must match. Leave empty for all
                senders.
              </p>

              {/* Sender IDs (exact JID) */}
              <div className="mb-3">
                <label className="label text-xs">
                  Chat / Sender IDs (exact JID match)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={senderIdInput}
                    onChange={(e) => setSenderIdInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSenderId()}
                    className="input flex-1"
                    placeholder="e.g., 31612345678@s.whatsapp.net"
                  />
                  <button onClick={addSenderId} className="btn btn-secondary">
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {rule.match.sender.ids.map((id, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200 rounded-full text-sm"
                    >
                      🆔 {id}
                      <button
                        onClick={() => removeSenderId(i)}
                        className="ml-1 hover:text-danger-text"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Sender Phone Numbers */}
              <div>
                <label className="label text-xs">
                  Phone Numbers (flexible match, auto-extracts from JID)
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={senderInput}
                    onChange={(e) => setSenderInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSenderNumber()}
                    className="input flex-1"
                    placeholder="e.g., 31612345678"
                  />
                  <button
                    onClick={addSenderNumber}
                    className="btn btn-secondary"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {rule.match.sender.numbers.map((num, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 rounded-full text-sm"
                    >
                      📱 {num}
                      <button
                        onClick={() => removeSenderNumber(i)}
                        className="ml-1 hover:text-danger-text"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Text filter */}
            {hasTextEvents && (
              <div>
                <label className="label">Text Filter (optional)</label>
                <div className="space-y-2">
                  <div>
                    <label className="label text-xs">Match Mode</label>
                    <select
                      value={rule.match.text.mode}
                      onChange={(e) =>
                        setRule({
                          ...rule,
                          match: {
                            ...rule.match,
                            text: {
                              ...rule.match.text,
                              mode: e.target.value as TextMatchMode,
                            },
                          },
                        })
                      }
                      className="input"
                    >
                      <option value="contains">
                        Contains (normalised, case-insensitive)
                      </option>
                      <option value="starts_with">
                        Starts with (normalised, case-insensitive)
                      </option>
                      <option value="regex">Regex (advanced)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs">
                      Patterns
                      {rule.match.text.mode === "contains" && (
                        <span className="text-mushroom-text-muted ml-1">
                          (matched after lowercasing &amp; trimming)
                        </span>
                      )}
                      {rule.match.text.mode === "regex" && (
                        <span className="text-mushroom-text-muted ml-1">
                          (JavaScript regex syntax)
                        </span>
                      )}
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={patternInput}
                        onChange={(e) => setPatternInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addPattern()}
                        className="input flex-1"
                        placeholder={
                          rule.match.text.mode === "regex"
                            ? "e.g., ^hello\\b"
                            : "e.g., goodnight"
                        }
                      />
                      <button
                        onClick={addPattern}
                        className="btn btn-secondary"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {rule.match.text.patterns.map((p, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2 py-1 bg-whatsapp-muted text-whatsapp rounded-full text-sm"
                        >
                          {rule.match.text.mode === "regex" ? `/${p}/` : p}
                          <button
                            onClick={() => removePattern(i)}
                            className="ml-1 hover:text-danger-text"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="card">
          <h3 className="font-medium text-mushroom-text mb-3">⚡ Actions *</h3>
          <div className="space-y-3">
            {rule.actions.map((action, i) => (
              <div
                key={i}
                className="p-3 bg-mushroom-bg-secondary rounded-mushroom"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-mushroom-text">
                    {action.type === "ha_service"
                      ? "🏠 HA Service"
                      : "💬 WhatsApp Reply"}
                  </span>
                  <button
                    onClick={() => removeAction(i)}
                    className="text-danger-text hover:text-danger"
                  >
                    Remove
                  </button>
                </div>
                {action.type === "ha_service" ? (
                  <div className="space-y-2">
                    <div>
                      <label className="label text-xs">Service</label>
                      <input
                        type="text"
                        value={action.service || ""}
                        onChange={(e) =>
                          updateAction(i, { service: e.target.value })
                        }
                        className="input"
                        placeholder="e.g., script.turn_on"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Target</label>
                      <select
                        value={action.target?.entity_id || ""}
                        onChange={(e) =>
                          updateAction(i, {
                            target: { entity_id: e.target.value },
                          })
                        }
                        className="input"
                      >
                        <option value="">Select entity...</option>
                        {scripts.map((s) => (
                          <option key={s.entity_id} value={s.entity_id}>
                            {s.name || s.entity_id}
                          </option>
                        ))}
                      </select>
                    </div>
                    {serviceDetails[i] &&
                      Object.keys(serviceDetails[i].fields || {}).length >
                        0 && (
                        <div>
                          <label className="label text-xs">Parameters</label>
                          <div className="space-y-2 bg-mushroom-bg p-2 rounded">
                            {Object.entries(serviceDetails[i].fields).map(
                              ([fieldName, field]: [string, any]) => (
                                <div key={fieldName}>
                                  <label className="text-xs text-mushroom-text-secondary">
                                    {fieldName}{" "}
                                    {field.required && (
                                      <span className="text-danger-text">
                                        *
                                      </span>
                                    )}
                                  </label>
                                  {field.description && (
                                    <p className="text-xs text-mushroom-text-muted mb-1">
                                      {field.description}
                                    </p>
                                  )}
                                  <input
                                    type="text"
                                    value={action.data?.[fieldName] || ""}
                                    onChange={(e) =>
                                      updateAction(i, {
                                        data: {
                                          ...action.data,
                                          [fieldName]: e.target.value,
                                        },
                                      })
                                    }
                                    className="input text-sm"
                                    placeholder={
                                      field.example ? String(field.example) : ""
                                    }
                                  />
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={action.text || ""}
                    onChange={(e) => updateAction(i, { text: e.target.value })}
                    className="input"
                    placeholder="Reply message..."
                  />
                )}
              </div>
            ))}
            <div className="flex space-x-2">
              <button
                onClick={() => addAction("ha_service")}
                className="btn btn-secondary flex-1"
              >
                + Call HA Service
              </button>
              <button
                onClick={() => addAction("reply_whatsapp")}
                className="btn btn-secondary flex-1"
              >
                + WhatsApp Reply
              </button>
            </div>
          </div>
        </div>

        <button onClick={handleAdd} className="btn btn-success w-full">
          ➕ Add Rule to YAML
        </button>
      </div>

      {/* Preview */}
      <div>
        <div className="card sticky top-4">
          <h3 className="font-medium text-mushroom-text mb-3">YAML Preview</h3>
          <pre className="bg-mushroom-bg p-4 rounded-mushroom overflow-x-auto text-sm text-mushroom-text-secondary border border-mushroom-border">
            {preview}
          </pre>
        </div>
      </div>
    </div>
  );
}
