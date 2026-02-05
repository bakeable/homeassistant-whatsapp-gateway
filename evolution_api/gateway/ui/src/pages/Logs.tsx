import { useCallback, useEffect, useState } from "react";
import { logsApi } from "../api";

interface Message {
  id: number;
  chat_id: string;
  chat_name: string;
  sender_id: string;
  content: string;
  message_type: string;
  is_from_me: boolean;
  provider_message_id: string;
  received_at: string;
  processed: boolean;
}

interface RuleFire {
  id: number;
  rule_id: string;
  rule_name: string;
  event_type: string;
  message_id: number;
  chat_id: string;
  action_type: string;
  action_details: string;
  success: boolean;
  error_message: string | null;
  fired_at: string;
}

interface EventLogEntry {
  id: number;
  event_type: string;
  instance_name: string;
  chat_id: string | null;
  sender_id: string | null;
  summary: string | null;
  received_at: string;
}

export default function LogsPage() {
  const [tab, setTab] = useState<"messages" | "rules" | "events">("messages");
  const [messages, setMessages] = useState<Message[]>([]);
  const [ruleFires, setRuleFires] = useState<RuleFire[]>([]);
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventFilter, setEventFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const limit = 50;

  // Load data
  const loadMessages = useCallback(
    async (reset = false) => {
      if (loading) return;
      setLoading(true);
      try {
        const p = reset ? 1 : page;
        const data = await logsApi.getMessages({ page: p, limit });
        if (reset) {
          setMessages(data);
          setPage(1);
        } else {
          setMessages((prev) => [...prev, ...data]);
        }
        setHasMore(data.length === limit);
        if (!reset) setPage(p + 1);
      } catch (e) {
        console.error("Failed to load messages:", e);
      } finally {
        setLoading(false);
      }
    },
    [loading, page],
  );

  const loadRuleFires = useCallback(
    async (reset = false) => {
      if (loading) return;
      setLoading(true);
      try {
        const p = reset ? 1 : page;
        const data = await logsApi.getRuleFires({ page: p, limit });
        if (reset) {
          setRuleFires(data);
          setPage(1);
        } else {
          setRuleFires((prev) => [...prev, ...data]);
        }
        setHasMore(data.length === limit);
        if (!reset) setPage(p + 1);
      } catch (e) {
        console.error("Failed to load rule fires:", e);
      } finally {
        setLoading(false);
      }
    },
    [loading, page],
  );

  const loadEvents = useCallback(
    async (reset = false) => {
      if (loading) return;
      setLoading(true);
      try {
        const p = reset ? 1 : page;
        const data = await logsApi.getEvents({
          page: p,
          limit,
          event_type: eventFilter || undefined,
        });
        if (reset) {
          setEvents(data.events);
          setPage(1);
        } else {
          setEvents((prev) => [...prev, ...data.events]);
        }
        setEventsTotal(data.total);
        setHasMore(data.events.length === limit);
        if (!reset) setPage(p + 1);
      } catch (e) {
        console.error("Failed to load events:", e);
      } finally {
        setLoading(false);
      }
    },
    [loading, page, eventFilter],
  );

  // Initial load
  useEffect(() => {
    if (tab === "messages") {
      loadMessages(true);
    } else if (tab === "rules") {
      loadRuleFires(true);
    } else {
      loadEvents(true);
    }
  }, [tab]);

  // Re-load events when filter changes
  useEffect(() => {
    if (tab === "events") {
      loadEvents(true);
    }
  }, [eventFilter]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (tab === "messages") {
        loadMessages(true);
      } else if (tab === "rules") {
        loadRuleFires(true);
      } else {
        loadEvents(true);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, tab]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString();
  };

  const loadMore = () => {
    if (tab === "messages") loadMessages();
    else if (tab === "rules") loadRuleFires();
    else loadEvents();
  };

  const refresh = () => {
    if (tab === "messages") loadMessages(true);
    else if (tab === "rules") loadRuleFires(true);
    else loadEvents(true);
  };

  const currentEmpty =
    (tab === "messages" && messages.length === 0) ||
    (tab === "rules" && ruleFires.length === 0) ||
    (tab === "events" && events.length === 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-mushroom-text">Logs</h2>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 text-sm text-mushroom-text-secondary">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-mushroom-bg border-mushroom-border text-primary focus:ring-primary/30"
            />
            <span>Auto-refresh (5s)</span>
          </label>
          <button
            onClick={refresh}
            className="btn btn-secondary"
            disabled={loading}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-mushroom-border">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setTab("messages")}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              tab === "messages"
                ? "border-primary text-primary"
                : "border-transparent text-mushroom-text-secondary hover:text-mushroom-text hover:border-mushroom-accent"
            }`}
          >
            📨 Messages
          </button>
          <button
            onClick={() => setTab("rules")}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              tab === "rules"
                ? "border-primary text-primary"
                : "border-transparent text-mushroom-text-secondary hover:text-mushroom-text hover:border-mushroom-accent"
            }`}
          >
            ⚡ Rule Executions
          </button>
          <button
            onClick={() => setTab("events")}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
              tab === "events"
                ? "border-primary text-primary"
                : "border-transparent text-mushroom-text-secondary hover:text-mushroom-text hover:border-mushroom-accent"
            }`}
          >
            📡 Events
          </button>
        </nav>
      </div>

      {tab === "messages" ? (
        <MessagesTable messages={messages} formatDate={formatDate} />
      ) : tab === "rules" ? (
        <RuleFiresTable ruleFires={ruleFires} formatDate={formatDate} />
      ) : (
        <EventsTable
          events={events}
          total={eventsTotal}
          formatDate={formatDate}
          eventFilter={eventFilter}
          setEventFilter={setEventFilter}
        />
      )}

      {/* Load More */}
      {hasMore && !currentEmpty && (
        <div className="text-center">
          <button
            onClick={loadMore}
            className="btn btn-secondary"
            disabled={loading}
          >
            {loading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && currentEmpty && (
        <div className="text-center py-12 text-mushroom-text-muted">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-mushroom-text-secondary">
            No{" "}
            {tab === "messages"
              ? "messages"
              : tab === "rules"
                ? "rule executions"
                : "events"}{" "}
            yet.
          </p>
          <p className="text-sm mt-1">
            {tab === "messages"
              ? "Send a message to your WhatsApp account to see it here."
              : tab === "rules"
                ? "Configure some rules and send matching messages."
                : "Events will appear here once the webhook is registered with Evolution API."}
          </p>
        </div>
      )}
    </div>
  );
}

function MessagesTable({
  messages,
  formatDate,
}: {
  messages: Message[];
  formatDate: (d: string) => string;
}) {
  return (
    <div className="overflow-x-auto card p-0">
      <table className="min-w-full divide-y divide-mushroom-border">
        <thead className="bg-mushroom-bg-secondary">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Time
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Chat
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Sender
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Message
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-mushroom-border">
          {messages.map((msg) => (
            <tr
              key={msg.id}
              className={`transition-colors ${msg.is_from_me ? "bg-info-muted" : "hover:bg-mushroom-card-hover"}`}
            >
              <td className="px-4 py-3 whitespace-nowrap text-sm text-mushroom-text-muted">
                {formatDate(msg.received_at)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm font-medium text-mushroom-text">
                  {msg.chat_name || msg.chat_id}
                </div>
                <div className="text-xs text-mushroom-text-muted truncate max-w-[150px]">
                  {msg.chat_id}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-mushroom-text">
                {msg.is_from_me ? (
                  <span className="text-info-text">You</span>
                ) : (
                  <span>{msg.sender_id}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div
                  className="text-sm text-mushroom-text max-w-md truncate"
                  title={msg.content}
                >
                  {msg.message_type !== "text" && (
                    <span className="inline-block px-2 py-0.5 bg-mushroom-bg text-mushroom-text-secondary rounded text-xs mr-2">
                      {msg.message_type}
                    </span>
                  )}
                  {msg.content || (
                    <span className="text-mushroom-text-muted italic">
                      (no text)
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {msg.processed ? (
                  <span className="status-badge status-connected">
                    ✓ Processed
                  </span>
                ) : (
                  <span className="status-badge bg-mushroom-bg text-mushroom-text-secondary">
                    Received
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RuleFiresTable({
  ruleFires,
  formatDate,
}: {
  ruleFires: RuleFire[];
  formatDate: (d: string) => string;
}) {
  return (
    <div className="overflow-x-auto card p-0">
      <table className="min-w-full divide-y divide-mushroom-border">
        <thead className="bg-mushroom-bg-secondary">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Time
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Rule
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Event
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Action
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Details
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-mushroom-border">
          {ruleFires.map((fire) => (
            <tr
              key={fire.id}
              className={`transition-colors ${fire.success ? "hover:bg-mushroom-card-hover" : "bg-danger-muted"}`}
            >
              <td className="px-4 py-3 whitespace-nowrap text-sm text-mushroom-text-muted">
                {formatDate(fire.fired_at)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-sm font-medium text-mushroom-text">
                  {fire.rule_name}
                </div>
                <div className="text-xs text-mushroom-text-muted">
                  {fire.rule_id}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="inline-block px-2 py-0.5 bg-mushroom-bg text-mushroom-text-secondary rounded text-xs font-mono">
                  {fire.event_type}
                </span>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span
                  className={`status-badge ${
                    fire.action_type === "ha_service"
                      ? "bg-info-muted text-info-text"
                      : "bg-whatsapp-muted text-whatsapp"
                  }`}
                >
                  {fire.action_type === "ha_service"
                    ? "🏠 HA Service"
                    : "💬 Reply"}
                </span>
              </td>
              <td className="px-4 py-3">
                <div
                  className="text-sm text-mushroom-text max-w-md truncate"
                  title={fire.action_details}
                >
                  {fire.action_details}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {fire.success ? (
                  <span className="status-badge status-connected">
                    ✓ Success
                  </span>
                ) : (
                  <div>
                    <span className="status-badge status-disconnected">
                      ✗ Failed
                    </span>
                    {fire.error_message && (
                      <div
                        className="text-xs text-danger-text mt-1 max-w-xs truncate"
                        title={fire.error_message}
                      >
                        {fire.error_message}
                      </div>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventsTable({
  events,
  total,
  formatDate,
  eventFilter,
  setEventFilter,
}: {
  events: EventLogEntry[];
  total: number;
  formatDate: (d: string) => string;
  eventFilter: string;
  setEventFilter: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center space-x-3">
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="input w-auto"
        >
          <option value="">All event types</option>
          <option value="MESSAGES_UPSERT">MESSAGES_UPSERT</option>
          <option value="MESSAGES_UPDATE">MESSAGES_UPDATE</option>
          <option value="MESSAGES_DELETE">MESSAGES_DELETE</option>
          <option value="SEND_MESSAGE">SEND_MESSAGE</option>
          <option value="CONNECTION_UPDATE">CONNECTION_UPDATE</option>
          <option value="CONTACTS_UPDATE">CONTACTS_UPDATE</option>
          <option value="CONTACTS_UPSERT">CONTACTS_UPSERT</option>
          <option value="GROUPS_UPSERT">GROUPS_UPSERT</option>
          <option value="GROUPS_UPDATE">GROUPS_UPDATE</option>
          <option value="GROUP_PARTICIPANTS_UPDATE">
            GROUP_PARTICIPANTS_UPDATE
          </option>
          <option value="PRESENCE_UPDATE">PRESENCE_UPDATE</option>
          <option value="CHATS_UPSERT">CHATS_UPSERT</option>
          <option value="CHATS_UPDATE">CHATS_UPDATE</option>
          <option value="CHATS_DELETE">CHATS_DELETE</option>
          <option value="CALL">CALL</option>
          <option value="QRCODE_UPDATED">QRCODE_UPDATED</option>
          <option value="LABELS_EDIT">LABELS_EDIT</option>
          <option value="LABELS_ASSOCIATION">LABELS_ASSOCIATION</option>
        </select>
        <span className="text-sm text-mushroom-text-muted">
          {total} total event{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto card p-0">
        <table className="min-w-full divide-y divide-mushroom-border">
          <thead className="bg-mushroom-bg-secondary">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
                Event Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
                Instance
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
                Chat / Sender
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-mushroom-text-muted uppercase tracking-wider">
                Summary
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mushroom-border">
            {events.map((evt) => (
              <tr
                key={evt.id}
                className="hover:bg-mushroom-card-hover transition-colors"
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-mushroom-text-muted">
                  {formatDate(evt.received_at)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-block px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono">
                    {evt.event_type}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-mushroom-text-secondary">
                  {evt.instance_name || "-"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div
                    className="text-sm text-mushroom-text truncate max-w-[200px]"
                    title={evt.chat_id || ""}
                  >
                    {evt.chat_id || "-"}
                  </div>
                  {evt.sender_id && (
                    <div className="text-xs text-mushroom-text-muted truncate max-w-[200px]">
                      from: {evt.sender_id}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div
                    className="text-sm text-mushroom-text max-w-md truncate"
                    title={evt.summary || ""}
                  >
                    {evt.summary || (
                      <span className="text-mushroom-text-muted italic">
                        (no summary)
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
