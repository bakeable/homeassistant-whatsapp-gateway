import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState } from "react";
import { haApi, waApi } from "../api";

interface ConnectionStatus {
  whatsapp: "connected" | "disconnected" | "connecting" | "qr" | "unknown";
  ha: "connected" | "disconnected" | "unknown";
  instance?: string;
  phone?: string;
}

export default function SetupPage() {
  const [status, setStatus] = useState<ConnectionStatus>({
    whatsapp: "unknown",
    ha: "unknown",
  });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrType, setQrType] = useState<"base64" | "text">("base64");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check connection status
  const checkStatus = useCallback(async () => {
    try {
      // Check WhatsApp status (auto-creates instance if needed)
      const waStatus = await waApi.getStatus();
      setStatus((prev) => ({
        ...prev,
        whatsapp: waStatus.status || "disconnected",
        instance: waStatus.instance,
        phone: waStatus.phone,
      }));

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
          const waStatus = await waApi.getStatus();
          if (waStatus.status === "connected") {
            setQrCode(null);
            setStatus((prev) => ({
              ...prev,
              whatsapp: "connected",
              phone: waStatus.phone,
            }));
          }
        } catch (e) {
          // Ignore polling errors
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [qrCode]);

  // Generate QR code
  const handleConnect = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get QR code (instance is auto-created)
      const qrData = await waApi.connect();

      if (qrData.qr) {
        setQrCode(qrData.qr);
        setQrType(qrData.qr_type || "base64");
        setStatus((prev) => ({ ...prev, whatsapp: "qr" }));
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
      await waApi.disconnect();
      setStatus((prev) => ({
        ...prev,
        whatsapp: "disconnected",
        phone: undefined,
      }));
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
      unknown: "bg-mushroom-card text-mushroom-text-muted",
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
      <h2 className="text-2xl font-semibold text-mushroom-text">Setup</h2>

      {/* Connection Status */}
      <div className="card">
        <h3 className="text-lg font-medium text-mushroom-text mb-4">
          Connection Status
        </h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-mushroom-text-secondary">WhatsApp:</span>
            <StatusBadge status={status.whatsapp} label={status.whatsapp} />
            {status.phone && (
              <span className="text-sm text-mushroom-text-muted">
                ({status.phone})
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-mushroom-text-secondary">
              Home Assistant:
            </span>
            <StatusBadge status={status.ha} label={status.ha} />
          </div>
        </div>
        <button onClick={checkStatus} className="btn btn-secondary mt-4">
          🔄 Refresh Status
        </button>
      </div>

      {/* WhatsApp Connection */}
      <div className="card">
        <h3 className="text-lg font-medium text-mushroom-text mb-4">
          WhatsApp Connection
        </h3>

        {error && (
          <div className="mb-4 p-4 bg-danger-muted border border-danger/30 text-danger-text rounded-mushroom">
            {error}
          </div>
        )}

        {qrCode ? (
          <div className="space-y-4">
            <p className="text-mushroom-text-secondary">
              Scan this QR code with WhatsApp on your phone:
            </p>
            <ol className="text-sm text-mushroom-text-muted list-decimal list-inside space-y-1">
              <li>Open WhatsApp on your phone</li>
              <li>Go to Settings → Linked Devices</li>
              <li>Tap "Link a Device"</li>
              <li>Scan the QR code below</li>
            </ol>
            <div className="qr-container mx-auto">
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
            <p className="text-sm text-mushroom-text-muted text-center animate-pulse-soft">
              Waiting for connection... (polling every 2 seconds)
            </p>
            <button
              onClick={() => setQrCode(null)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
          </div>
        ) : status.whatsapp === "connected" ? (
          <div className="space-y-4">
            <div className="p-4 bg-success-muted border border-success/30 rounded-mushroom">
              <p className="text-success-text font-medium">
                ✓ WhatsApp Connected
              </p>
              <p className="text-success-text/80 text-sm">
                {status.phone
                  ? `Connected as ${status.phone}`
                  : "Instance is connected and ready."}
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
            disabled={loading}
            className="btn btn-success"
          >
            {loading ? "Generating QR..." : "📷 Connect WhatsApp"}
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="card bg-info-muted border-info/30">
        <h3 className="text-lg font-medium text-info-text mb-2">Quick Start</h3>
        <ol className="text-info-text/80 list-decimal list-inside space-y-2">
          <li>Connect your WhatsApp by scanning the QR code above</li>
          <li>
            Go to the <strong className="text-info-text">Chats</strong> tab to
            see and enable groups/contacts
          </li>
          <li>
            Create rules in the{" "}
            <strong className="text-info-text">Rules</strong> tab to automate
            actions
          </li>
          <li>
            Monitor activity in the{" "}
            <strong className="text-info-text">Logs</strong> tab
          </li>
        </ol>
      </div>
    </div>
  );
}
