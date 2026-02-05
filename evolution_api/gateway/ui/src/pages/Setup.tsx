import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { haApi, waApi } from "../api";

interface ConnectionStatus {
  evolution: "connected" | "disconnected" | "connecting" | "qr" | "unknown";
  ha: "connected" | "disconnected" | "unknown";
}

export default function SetupPage() {
  const [status, setStatus] = useState<ConnectionStatus>({
    evolution: "unknown",
    ha: "unknown",
  });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrType, setQrType] = useState<"base64" | "text">("base64");
  const [instanceName, setInstanceName] = useState("HomeAssistant");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check connection status
  const checkStatus = useCallback(async () => {
    try {
      // Check Evolution API / WhatsApp status
      const waStatus = await waApi.getStatus();
      setStatus((prev) => ({
        ...prev,
        evolution: waStatus.evolution_connected ? "connected" : "disconnected",
      }));
      setInstanceName(waStatus.instance_name || "HomeAssistant");

      // Check HA status
      const haStatus = await haApi.getStatus();
      setStatus((prev) => ({
        ...prev,
        ha: haStatus.connected ? "connected" : "disconnected",
      }));
    } catch (e) {
      console.error("Status check failed:", e);
    }
  }, []);

  // Initial status check
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Poll status when QR is showing
  useEffect(() => {
    if (qrCode) {
      const interval = setInterval(async () => {
        try {
          const instanceStatus = await waApi.getInstanceStatus(instanceName);
          if (instanceStatus.status === "connected") {
            setQrCode(null);
            setStatus((prev) => ({ ...prev, evolution: "connected" }));
          }
        } catch (e) {
          // Ignore polling errors
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [qrCode, instanceName]);

  // Generate QR code
  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      // Ensure instance exists
      await waApi.createInstance(instanceName);

      // Get QR code
      const qrData = await waApi.connect(instanceName);

      if (qrData.qr) {
        setQrCode(qrData.qr);
        setQrType(qrData.qr_type || "base64");
        setStatus((prev) => ({ ...prev, evolution: "qr" }));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    setLoading(true);
    setError(null);
    try {
      await waApi.disconnect(instanceName);
      setStatus((prev) => ({ ...prev, evolution: "disconnected" }));
      setQrCode(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const StatusBadge = ({
    status,
    label,
  }: {
    status: string;
    label: string;
  }) => {
    const colors = {
      connected: "status-connected",
      disconnected: "status-disconnected",
      connecting: "status-connecting",
      qr: "status-connecting",
      unknown: "bg-gray-100 text-gray-800",
    };
    return (
      <span
        className={`status-badge ${colors[status as keyof typeof colors] || colors.unknown}`}
      >
        {status === "connected" ? "✓" : status === "disconnected" ? "✗" : "○"}{" "}
        {label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Setup</h2>

      {/* Connection Status */}
      <div className="card">
        <h3 className="text-lg font-medium mb-4">Connection Status</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-gray-600">Evolution API:</span>
            <StatusBadge status={status.evolution} label={status.evolution} />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-600">Home Assistant:</span>
            <StatusBadge status={status.ha} label={status.ha} />
          </div>
        </div>
        <button onClick={checkStatus} className="btn btn-secondary mt-4">
          🔄 Refresh Status
        </button>
      </div>

      {/* WhatsApp Connection */}
      <div className="card">
        <h3 className="text-lg font-medium mb-4">WhatsApp Connection</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="label">Instance Name</label>
          <input
            type="text"
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value)}
            className="input max-w-xs"
            disabled={status.evolution === "connected"}
          />
        </div>

        {qrCode ? (
          <div className="space-y-4">
            <p className="text-gray-600">
              Scan this QR code with WhatsApp on your phone:
            </p>
            <ol className="text-sm text-gray-500 list-decimal list-inside space-y-1">
              <li>Open WhatsApp on your phone</li>
              <li>Go to Settings → Linked Devices</li>
              <li>Tap "Link a Device"</li>
              <li>Scan the QR code below</li>
            </ol>
            <div className="flex justify-center p-4 bg-white border rounded-lg">
              {qrType === "base64" ? (
                <img
                  src={qrCode}
                  alt="WhatsApp QR Code"
                  className="max-w-[280px]"
                />
              ) : (
                <QRCodeSVG value={qrCode} size={280} />
              )}
            </div>
            <p className="text-sm text-gray-500 text-center">
              Waiting for connection... (polling every 2 seconds)
            </p>
            <button
              onClick={() => setQrCode(null)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        ) : status.evolution === "connected" ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700 font-medium">✓ WhatsApp Connected</p>
              <p className="text-green-600 text-sm">
                Instance "{instanceName}" is connected and ready.
              </p>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="btn btn-danger"
            >
              {loading ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={loading || !instanceName}
            className="btn btn-success"
          >
            {loading ? "Generating QR..." : "📷 Generate QR Code"}
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="text-lg font-medium text-blue-800 mb-2">Quick Start</h3>
        <ol className="text-blue-700 list-decimal list-inside space-y-2">
          <li>Connect your WhatsApp by scanning the QR code above</li>
          <li>
            Go to the <strong>Chats</strong> tab to see and enable
            groups/contacts
          </li>
          <li>
            Create rules in the <strong>Rules</strong> tab to automate actions
          </li>
          <li>
            Monitor activity in the <strong>Logs</strong> tab
          </li>
        </ol>
      </div>
    </div>
  );
}
