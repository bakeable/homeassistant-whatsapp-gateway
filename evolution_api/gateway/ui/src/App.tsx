import { NavLink, Route, Routes } from 'react-router-dom'
import ChatsPage from './pages/Chats'
import LogsPage from './pages/Logs'
import RulesPage from './pages/Rules'
import SetupPage from './pages/Setup'
import TestPage from './pages/Test'

function App() {
  const tabs = [
    { path: '/', label: 'Setup', icon: '⚙️' },
    { path: '/chats', label: 'Chats', icon: '💬' },
    { path: '/rules', label: 'Rules', icon: '📋' },
    { path: '/test', label: 'Test', icon: '🧪' },
    { path: '/logs', label: 'Logs', icon: '📊' },
  ]

  return (
    <div className="min-h-screen bg-ha-background">
      {/* Header */}
      <header className="bg-wa-dark text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">📱</span>
            <h1 className="text-xl font-semibold">WhatsApp Gateway</h1>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-1">
            {tabs.map((tab) => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.path === '/'}
                className={({ isActive }) =>
                  `px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-wa-dark text-wa-dark'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
          <Route path="/" element={<SetupPage />} />
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/logs" element={<LogsPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
