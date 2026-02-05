import { useState } from "react";
import { rulesApi, waApi } from "../api";

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

interface EvaluatedRule {
  id: string;
  name: string;
  matched: boolean;
  reason: string;
  skippedCooldown?: boolean;
  stoppedChain?: boolean;
}

interface ExecutedAction {
  ruleId: string;
  ruleName: string;
  type: string;
  details: string;
  success: boolean;
  error?: string;
  durationMs: number;
}

interface TestExecuteResult {
  evaluated_rules: EvaluatedRule[];
  executed_actions: ExecutedAction[];
  logs: string[];
}

export default function TestPage() {
  // ── Message Sending state ──
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<
    "image" | "document" | "audio" | "video"
  >("image");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // ── Rule Execution state ──
  const [ruleEvent, setRuleEvent] = useState("MESSAGES_UPSERT");
  const [ruleChatId, setRuleChatId] = useState("");
  const [ruleSenderId, setRuleSenderId] = useState("");
  const [ruleText, setRuleText] = useState("");
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<TestExecuteResult | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  // ── Message Sending handlers ──
  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !message) {
      setSendResult({
        success: false,
        message: "Recipient and message are required",
      });
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      const response = await waApi.sendTestMessage(recipient, message);
      setSendResult({
        success: true,
        message: `✅ Message sent successfully! ID: ${response.message_id || "N/A"}`,
      });
      setMessage("");
    } catch (error: any) {
      setSendResult({
        success: false,
        message: `❌ Failed to send: ${error.message}`,
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !mediaUrl) {
      setSendResult({
        success: false,
        message: "Recipient and media URL are required",
      });
      return;
    }
    setSending(true);
    setSendResult(null);
    try {
      const response = await waApi.sendTestMedia(
        recipient,
        mediaUrl,
        mediaType,
      );
      setSendResult({
        success: true,
        message: `✅ Media sent successfully! ID: ${response.message_id || "N/A"}`,
      });
      setMediaUrl("");
    } catch (error: any) {
      setSendResult({
        success: false,
        message: `❌ Failed to send media: ${error.message}`,
      });
    } finally {
      setSending(false);
    }
  };

  // ── Rule Execution handler ──
  const handleTestExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setExecuting(true);
    setExecResult(null);
    setExecError(null);
    try {
      const result: TestExecuteResult = await rulesApi.testExecute({
        chat_id: ruleChatId,
        sender_id: ruleSenderId,
        text: ruleText,
        event: ruleEvent,
      });
      setExecResult(result);
    } catch (error: any) {
      setExecError(error.message);
    } finally {
      setExecuting(false);
    }
  };

  const matchedCount =
    execResult?.evaluated_rules.filter((r) => r.matched).length || 0;
  const actionCount = execResult?.executed_actions.length || 0;
  const allSuccess =
    execResult?.executed_actions.every((a) => a.success) ?? true;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-mushroom-text">
          Test &amp; Debug
        </h2>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1: Rule Execution Testing
          ════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-mushroom-text">
          🧪 Test Rule Execution
        </h3>
        <p className="text-mushroom-text-secondary">
          Simulate an incoming event and{" "}
          <strong>execute matching rules for real</strong>. HA services will be
          called and WhatsApp replies will be sent!
        </p>

        <form onSubmit={handleTestExecute} className="space-y-4">
          <div className="card space-y-4">
            {/* Event Type */}
            <div>
              <label className="label">Event Type</label>
              <select
                value={ruleEvent}
                onChange={(e) => setRuleEvent(e.target.value)}
                className="input max-w-xs"
              >
                {EVOLUTION_EVENTS.map((ev) => (
                  <option key={ev} value={ev}>
                    {ev}
                  </option>
                ))}
              </select>
              <p className="text-sm text-mushroom-text-muted mt-1">
                The Evolution API event to simulate.
              </p>
            </div>

            {/* Chat ID */}
            <div>
              <label className="label">Chat ID</label>
              <input
                type="text"
                value={ruleChatId}
                onChange={(e) => setRuleChatId(e.target.value)}
                placeholder="e.g., 31612345678@s.whatsapp.net or 120363…@g.us"
                className="input"
              />
              <p className="text-sm text-mushroom-text-muted mt-1">
                JID of the chat. Ending in @g.us = group, @s.whatsapp.net =
                direct.
              </p>
            </div>

            {/* Sender ID */}
            <div>
              <label className="label">Sender ID</label>
              <input
                type="text"
                value={ruleSenderId}
                onChange={(e) => setRuleSenderId(e.target.value)}
                placeholder="e.g., 31612345678@s.whatsapp.net"
                className="input"
              />
              <p className="text-sm text-mushroom-text-muted mt-1">
                JID of the message sender. Used for sender.ids and
                sender.numbers matching.
              </p>
            </div>

            {/* Text */}
            <div>
              <label className="label">Message Text</label>
              <textarea
                value={ruleText}
                onChange={(e) => setRuleText(e.target.value)}
                rows={3}
                placeholder="Type the simulated message text..."
                className="input"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={executing}
                className="btn btn-primary"
              >
                {executing ? "⏳ Executing…" : "🚀 Execute Rules (LIVE)"}
              </button>
              <span className="text-sm text-danger-text font-medium">
                ⚠️ Actions will run for real!
              </span>
            </div>
          </div>
        </form>

        {/* Execution Error */}
        {execError && (
          <div className="p-4 rounded-mushroom bg-danger-muted border border-danger/30 text-danger-text">
            ❌ {execError}
          </div>
        )}

        {/* Execution Results */}
        {execResult && (
          <div className="space-y-4">
            {/* Summary */}
            <div
              className={`p-4 rounded-mushroom border ${
                actionCount === 0
                  ? "bg-mushroom-card border-mushroom-border text-mushroom-text"
                  : allSuccess
                    ? "bg-success-muted border-success/30 text-success-text"
                    : "bg-danger-muted border-danger/30 text-danger-text"
              }`}
            >
              <strong>
                {matchedCount === 0
                  ? "No rules matched."
                  : `${matchedCount} rule(s) matched → ${actionCount} action(s) executed${allSuccess ? " ✅" : " (some failed ❌)"}`}
              </strong>
            </div>

            {/* Evaluated Rules */}
            <div className="card">
              <h4 className="text-lg font-medium text-mushroom-text mb-3">
                📋 Evaluated Rules ({execResult.evaluated_rules.length})
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-mushroom-border text-left text-mushroom-text-muted">
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Rule</th>
                      <th className="py-2 pr-4">Reason</th>
                      <th className="py-2 pr-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {execResult.evaluated_rules.map((rule, i) => (
                      <tr
                        key={i}
                        className="border-b border-mushroom-border/50"
                      >
                        <td className="py-2 pr-4">
                          {rule.matched
                            ? "✅"
                            : rule.skippedCooldown
                              ? "⏳"
                              : "❌"}
                        </td>
                        <td className="py-2 pr-4">
                          <span className="font-mono text-xs">{rule.id}</span>
                          <br />
                          <span className="text-mushroom-text-muted">
                            {rule.name}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-mushroom-text-secondary font-mono text-xs">
                          {rule.reason}
                        </td>
                        <td className="py-2 pr-4 text-mushroom-text-muted text-xs">
                          {rule.skippedCooldown && "cooldown active"}
                          {rule.stoppedChain && "⛔ stopped chain"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Executed Actions */}
            {execResult.executed_actions.length > 0 && (
              <div className="card">
                <h4 className="text-lg font-medium text-mushroom-text mb-3">
                  ⚡ Executed Actions ({execResult.executed_actions.length})
                </h4>
                <div className="space-y-3">
                  {execResult.executed_actions.map((action, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-mushroom border ${
                        action.success
                          ? "bg-success-muted/50 border-success/20"
                          : "bg-danger-muted/50 border-danger/20"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {action.success ? "✅" : "❌"}{" "}
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-mushroom-bg">
                            {action.type}
                          </span>
                        </span>
                        <span className="text-xs text-mushroom-text-muted">
                          {action.durationMs}ms — rule: {action.ruleId}
                        </span>
                      </div>
                      <p className="text-sm text-mushroom-text-secondary mt-1">
                        {action.details}
                      </p>
                      {action.error && (
                        <p className="text-sm text-danger-text mt-1 font-mono">
                          Error: {action.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verbose Logs */}
            <div className="card">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="flex items-center gap-2 text-lg font-medium text-mushroom-text mb-2"
              >
                <span>{showLogs ? "▼" : "▶"}</span>
                📜 Execution Logs ({execResult.logs.length} lines)
              </button>
              {showLogs && (
                <pre className="bg-mushroom-bg p-3 rounded-mushroom text-xs font-mono text-mushroom-text-secondary overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap">
                  {execResult.logs.join("\n")}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2: Send Test Messages
          ════════════════════════════════════════════════════════════════ */}
      <hr className="border-mushroom-border" />

      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-mushroom-text">
          💬 Send Test Messages
        </h3>
        <p className="text-mushroom-text-secondary">
          Send real WhatsApp messages to verify your connection.
        </p>

        {sendResult && (
          <div
            className={`p-4 rounded-mushroom ${
              sendResult.success
                ? "bg-success-muted border border-success/30 text-success-text"
                : "bg-danger-muted border border-danger/30 text-danger-text"
            }`}
          >
            {sendResult.message}
          </div>
        )}

        {/* Recipient Input */}
        <div className="card">
          <h4 className="text-lg font-medium text-mushroom-text mb-4">
            📱 Recipient
          </h4>
          <div className="space-y-2">
            <label className="label">Phone Number or Chat ID</label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g., 1234567890 or 1234567890@s.whatsapp.net"
              className="input"
            />
            <p className="text-sm text-mushroom-text-muted">
              Enter a phone number (without + or spaces) or a full WhatsApp ID.
              For groups, use the group ID ending in @g.us
            </p>
          </div>
        </div>

        {/* Text Message Form */}
        <div className="card">
          <h4 className="text-lg font-medium text-mushroom-text mb-4">
            Send Text Message
          </h4>
          <form onSubmit={handleSendText} className="space-y-4">
            <div>
              <label className="label">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Type your message here..."
                className="input"
              />
            </div>
            <button
              type="submit"
              disabled={sending || !recipient || !message}
              className="btn btn-primary"
            >
              {sending ? "📤 Sending..." : "📤 Send Text Message"}
            </button>
          </form>
        </div>

        {/* Media Message Form */}
        <div className="card">
          <h4 className="text-lg font-medium text-mushroom-text mb-4">
            📎 Send Media
          </h4>
          <form onSubmit={handleSendMedia} className="space-y-4">
            <div>
              <label className="label">Media Type</label>
              <select
                value={mediaType}
                onChange={(e) => setMediaType(e.target.value as any)}
                className="input max-w-[200px]"
              >
                <option value="image">🖼️ Image</option>
                <option value="document">📄 Document</option>
                <option value="audio">🎵 Audio</option>
                <option value="video">🎬 Video</option>
              </select>
            </div>
            <div>
              <label className="label">Media URL</label>
              <input
                type="url"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="input"
              />
              <p className="text-sm text-mushroom-text-muted mt-1">
                Enter a publicly accessible URL to the media file.
              </p>
            </div>
            <button
              type="submit"
              disabled={sending || !recipient || !mediaUrl}
              className="btn btn-primary"
            >
              {sending ? "📤 Sending..." : "📤 Send Media"}
            </button>
          </form>
        </div>
      </div>

      {/* Help Section */}
      <div className="card bg-info-muted border-info/30">
        <h3 className="text-lg font-medium text-info-text mb-2">💡 Tips</h3>
        <ul className="text-sm text-info-text/80 space-y-1 list-disc list-inside">
          <li>
            <strong>Test Rule Execution</strong> runs your rules against a
            simulated message — actions fire for real (HA services, WhatsApp
            replies).
          </li>
          <li>
            Use <strong>Send Test Messages</strong> to verify basic WhatsApp
            connectivity.
          </li>
          <li>
            Phone numbers should include country code (e.g., 31612345678 for
            Netherlands).
          </li>
          <li>Do not include + or spaces in phone numbers.</li>
          <li>For groups, find the Group ID in the Chats tab after syncing.</li>
          <li>Check the Logs page for detailed execution history.</li>
        </ul>
      </div>
    </div>
  );
}
