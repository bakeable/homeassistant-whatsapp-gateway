/**
 * API client for the WhatsApp Gateway API backend
 */

// Get the base URL for API calls
// The gateway runs on port 8099 and is exposed on the HA host
function getApiBase(): string {
  // Use the same hostname as the current page but on port 8099
  return `${window.location.protocol}//${window.location.hostname}:8099`;
}

const API_BASE = getApiBase();

async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    // No timeout for long-running operations
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || error.message || 'API Error');
  }
  
  return response.json();
}

// WhatsApp API
export const waApi = {
  getStatus: () => fetchApi('/api/wa/status'),
  
  createInstance: (instanceName: string) =>
    fetchApi('/api/wa/instances', {
      method: 'POST',
      body: JSON.stringify({ instance_name: instanceName }),
    }),
  
  connect: (instance: string) =>
    fetchApi(`/api/wa/instances/${instance}/connect`, { method: 'POST' }),
  
  getInstanceStatus: (instance: string) =>
    fetchApi(`/api/wa/instances/${instance}/status`),
  
  disconnect: (instance: string) =>
    fetchApi(`/api/wa/instances/${instance}/disconnect`, { method: 'POST' }),
  
  getChats: (params?: { type?: string; enabled?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.enabled !== undefined) query.set('enabled', String(params.enabled));
    return fetchApi(`/api/wa/chats?${query}`);
  },
  
  refreshChats: () =>
    fetchApi('/api/wa/chats/refresh', { method: 'POST' }),
  
  getRefreshStatus: () =>
    fetchApi('/api/wa/chats/refresh/status'),
  
  updateChat: (chatId: string, data: { enabled?: boolean }) =>
    fetchApi(`/api/wa/chats/${encodeURIComponent(chatId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  
  sendMessage: (to: string, text: string) =>
    fetchApi('/api/wa/send', {
      method: 'POST',
      body: JSON.stringify({ to, text }),
    }),
  
  sendTestMessage: (to: string, text: string) =>
    fetchApi('/api/wa/send', {
      method: 'POST',
      body: JSON.stringify({ to, text }),
    }),
  
  sendTestMedia: (to: string, mediaUrl: string, mediaType: string) =>
    fetchApi('/api/wa/send-media', {
      method: 'POST',
      body: JSON.stringify({ to, media_url: mediaUrl, media_type: mediaType }),
    }),
};

// Home Assistant API
export const haApi = {
  getStatus: () => fetchApi('/api/ha/status'),
  
  getEntities: (domain?: string) =>
    fetchApi(`/api/ha/entities${domain ? `?domain=${domain}` : ''}`),
  
  getScripts: () => fetchApi('/api/ha/scripts'),
  
  getAutomations: () => fetchApi('/api/ha/automations'),
  
  getScenes: () => fetchApi('/api/ha/scenes'),
  
  getAllowedServices: () => fetchApi('/api/ha/allowed-services'),
  
  callService: (service: string, target?: { entity_id?: string }, data?: Record<string, any>) =>
    fetchApi('/api/ha/call-service', {
      method: 'POST',
      body: JSON.stringify({ service, target, data }),
    }),
};

// Rules API
export const rulesApi = {
  getRules: () => fetchApi('/api/rules'),
  
  saveRules: (yaml: string) =>
    fetchApi('/api/rules', {
      method: 'PUT',
      body: JSON.stringify({ yaml }),
    }),
  
  validate: (yaml: string) =>
    fetchApi('/api/rules/validate', {
      method: 'POST',
      body: JSON.stringify({ yaml }),
    }),
  
  test: (message: { chat_id: string; sender_id: string; text: string }) =>
    fetchApi('/api/rules/test', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
  
  getRuleFires: (limit?: number, ruleId?: string) => {
    const query = new URLSearchParams();
    if (limit) query.set('limit', String(limit));
    if (ruleId) query.set('rule_id', ruleId);
    return fetchApi(`/api/rules/fires?${query}`);
  },
  
  reload: () => fetchApi('/api/rules/reload', { method: 'POST' }),
};

// Logs API
export const logsApi = {
  getMessages: (params?: { page?: number; limit?: number; chat_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.chat_id) query.set('chat_id', params.chat_id);
    return fetchApi(`/api/logs/messages?${query}`);
  },
  
  getRuleFires: (params?: { page?: number; limit?: number; rule_id?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.rule_id) query.set('rule_id', params.rule_id);
    return fetchApi(`/api/logs/rules?${query}`);
  },
};
