import { useEffect, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { waApi } from "./api";
import ChatsPage from "./pages/Chats";
import LogsPage from "./pages/Logs";
import RulesPage from "./pages/Rules";
import SetupPage from "./pages/Setup";
import TestPage from "./pages/Test";

function App() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const location = useLocation();

  // Check connection status on mount
  useEffect(() => {
    waApi
      .getStatus()
      .then((status) => {
        setIsConnected(status.state === "open");
      })
      .catch(() => {
        setIsConnected(false);
      });
  }, []);

  const tabs = [
    { path: "/", label: "Setup", icon: "⚙️" },
    { path: "/chats", label: "Chats", icon: "💬" },
    { path: "/rules", label: "Rules", icon: "📋" },
    { path: "/test", label: "Test", icon: "🧪" },
    { path: "/logs", label: "Logs", icon: "📊" },
  ];

  return (
    <div className="min-h-screen bg-mushroom-bg">
      {/* Header - Mushroom style */}
      <header className="bg-mushroom-card border-b border-mushroom-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-mushroom bg-whatsapp-muted flex items-center justify-center">
              <span className="text-xl">📱</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-mushroom-text">
                WhatsApp Gateway
              </h1>
              <p className="text-xs text-mushroom-text-muted">
                Home Assistant Add-on
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation - Mushroom pill style */}
      <nav className="bg-mushroom-bg-secondary border-b border-mushroom-border">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-2 py-3 overflow-x-auto">
            {tabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.path === "/"}
                className={({ isActive }) =>
                  `flex items-center px-4 py-2 rounded-mushroom text-sm font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-primary-muted text-primary border border-primary/30"
                      : "text-mushroom-text-secondary hover:bg-mushroom-card hover:text-mushroom-text"
                  }`
                }
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route
            path="/"
            element={
              isConnected === null ? (
                <div className="text-center text-mushroom-text-muted py-8">
                  Loading...
                </div>
              ) : isConnected && location.pathname === "/" ? (
                <Navigate to="/chats" replace />
              ) : (
                <SetupPage />
              )
            }
          />
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/logs" element={<LogsPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
