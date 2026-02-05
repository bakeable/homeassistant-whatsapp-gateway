import { useEffect, useRef, useState } from "react";
import { waApi } from "../api";

interface Chat {
  chat_id: string;
  type: "group" | "direct";
  name: string;
  phone_number?: string;
  enabled: boolean;
  last_message_at?: string;
}

interface SyncProgress {
  status:
    | "idle"
    | "fetching_groups"
    | "fetching_contacts"
    | "saving"
    | "complete"
    | "error";
  groupsCount: number;
  contactsCount: number;
  totalCount: number;
  currentStep: string;
  error: string | null;
}

export default function ChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<"all" | "group" | "direct">("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Load chats
  const loadChats = async () => {
    try {
      const data = await waApi.getChats({
        type: filter === "all" ? undefined : filter,
      });
      setChats(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Debug Evolution API endpoints
  const runDebug = async () => {
    try {
      setDebugInfo({ status: "loading..." });
      const response = await fetch("/api/wa/debug/endpoints");
      const data = await response.json();
      setDebugInfo(data);
    } catch (e: any) {
      setDebugInfo({ error: e.message });
    }
  };

  useEffect(() => {
    loadChats();
  }, [filter]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Check sync progress
  const checkProgress = async () => {
    try {
      const progress = await waApi.getRefreshStatus();
      setSyncProgress(progress);

      // If complete or error, stop polling
      if (progress.status === "complete" || progress.status === "error") {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        setRefreshing(false);

        // Reload chats on completion
        if (progress.status === "complete") {
          await loadChats();
        }

        // Clear progress after 5 seconds
        setTimeout(() => {
          setSyncProgress(null);
        }, 5000);
      }
    } catch (e: any) {
      console.error("Failed to check progress:", e);
    }
  };

  // Refresh chats from Evolution API
  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    setSyncProgress(null);

    try {
      const result = await waApi.refreshChats();

      if (result.status === "already_running" || result.status === "started") {
        // Start polling for progress
        checkProgress();
        pollingRef.current = setInterval(checkProgress, 2000);
      }
    } catch (e: any) {
      setError(e.message);
      setRefreshing(false);
    }
  };

  // Toggle chat enabled
  const handleToggle = async (chat: Chat) => {
    try {
      await waApi.updateChat(chat.chat_id, { enabled: !chat.enabled });
      setChats(
        chats.map((c) =>
          c.chat_id === chat.chat_id ? { ...c, enabled: !c.enabled } : c,
        ),
      );
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Filter chats by search
  const filteredChats = chats.filter(
    (chat) =>
      chat.name.toLowerCase().includes(search.toLowerCase()) ||
      chat.chat_id.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) {
    return <div className="text-center py-8">Loading chats...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Chats</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowDebug(!showDebug);
              if (!debugInfo) runDebug();
            }}
            className="btn btn-secondary"
          >
            🔧 Debug API
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-primary"
          >
            {refreshing ? "🔄 Syncing..." : "🔄 Sync from WhatsApp"}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {/* Debug Info Panel */}
      {showDebug && (
        <div className="card bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">
              🔧 Evolution API Debug
            </h3>
            <button
              onClick={runDebug}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              🔄 Refresh
            </button>
          </div>
          {debugInfo ? (
            <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-96">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500">Loading debug info...</p>
          )}
        </div>
      )}

      {/* Sync Progress */}
      {syncProgress && syncProgress.status !== "idle" && (
        <div className="card">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">
                {syncProgress.status === "complete"
                  ? "✅ Sync Complete"
                  : syncProgress.status === "error"
                    ? "❌ Sync Failed"
                    : "🔄 Syncing Chats..."}
              </h3>
              {syncProgress.status === "complete" && (
                <span className="text-sm text-green-600">
                  {syncProgress.totalCount} chats synced
                </span>
              )}
            </div>

            {/* Progress Bar */}
            {syncProgress.status !== "complete" &&
              syncProgress.status !== "error" && (
                <div className="space-y-2">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-wa-green h-2.5 rounded-full transition-all duration-500"
                      style={{
                        width:
                          syncProgress.status === "fetching_groups"
                            ? "33%"
                            : syncProgress.status === "fetching_contacts"
                              ? "66%"
                              : syncProgress.status === "saving"
                                ? "90%"
                                : "0%",
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {syncProgress.currentStep}
                  </p>
                </div>
              )}

            {/* Stats */}
            {(syncProgress.groupsCount > 0 ||
              syncProgress.contactsCount > 0) && (
              <div className="flex gap-4 text-sm text-gray-600">
                {syncProgress.groupsCount > 0 && (
                  <span>👥 {syncProgress.groupsCount} groups</span>
                )}
                {syncProgress.contactsCount > 0 && (
                  <span>👤 {syncProgress.contactsCount} contacts</span>
                )}
              </div>
            )}

            {syncProgress.status === "error" && syncProgress.error && (
              <p className="text-sm text-red-600">{syncProgress.error}</p>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search chats..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-600">Type:</span>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="input max-w-[150px]"
            >
              <option value="all">All</option>
              <option value="group">Groups</option>
              <option value="direct">Direct</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chats Table */}
      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Enabled
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Chat ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Last Message
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredChats.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  {chats.length === 0
                    ? 'No chats found. Click "Sync from WhatsApp" to load your chats.'
                    : "No chats match your search."}
                </td>
              </tr>
            ) : (
              filteredChats.map((chat) => (
                <tr
                  key={chat.chat_id}
                  className={!chat.enabled ? "bg-gray-50" : ""}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={chat.enabled}
                      onChange={() => handleToggle(chat)}
                      className="h-4 w-4 text-wa-green rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`status-badge ${
                        chat.type === "group"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {chat.type === "group" ? "👥 Group" : "👤 Direct"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <div>{chat.name}</div>
                    {chat.type === "direct" && chat.phone_number && (
                      <div className="text-xs text-gray-400">+{chat.phone_number}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                    {chat.type === "direct" && chat.phone_number
                      ? chat.phone_number
                      : chat.chat_id.length > 30
                        ? `${chat.chat_id.substring(0, 30)}...`
                        : chat.chat_id}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {chat.last_message_at
                      ? new Date(chat.last_message_at).toLocaleString()
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`/rules?chat=${encodeURIComponent(chat.chat_id)}`}
                      className="text-ha-primary hover:text-ha-secondary text-sm"
                    >
                      Create Rule →
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-500">
        💡 Enable chats to allow rules to process messages from them. Only
        enabled chats will trigger automations.
      </p>
    </div>
  );
}
