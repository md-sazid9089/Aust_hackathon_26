/*
 * Frontend — App Root Component
 * ================================
 * Main application shell with simple client-side routing.
 * Renders either the HomePage (landing) or MapPage (routing interface).
 *
 * Integration:
 *   - Wraps all pages with common layout (header/footer)
 *   - Manages page state (no React Router needed for hackathon scope)
 *   - Passes shared state (API connection status) to children
 */

import { useState, useEffect } from 'react';
import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import { checkHealth } from './services/api';

function App() {
  const [currentPage, setCurrentPage] = useState('home'); // 'home' | 'map'
  const [apiStatus, setApiStatus] = useState(null);       // health check result

  // Check backend health on mount
  useEffect(() => {
    checkHealth()
      .then(setApiStatus)
      .catch(() => setApiStatus({ status: 'offline' }));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      {/* ─── Header ─────────────────────────────────────────── */}
      <header className="glass-panel m-0 rounded-none border-x-0 border-t-0 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚀</span>
          <h1 className="text-xl font-bold bg-gradient-to-r from-transit-400 to-emerald-400 bg-clip-text text-transparent">
            GoliTransit
          </h1>
        </div>

        <nav className="flex items-center gap-4">
          <button
            id="nav-home"
            onClick={() => setCurrentPage('home')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentPage === 'home'
                ? 'bg-transit-600/30 text-transit-300'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          >
            Home
          </button>
          <button
            id="nav-map"
            onClick={() => setCurrentPage('map')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              currentPage === 'map'
                ? 'bg-transit-600/30 text-transit-300'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          >
            Route Map
          </button>

          {/* API Status Indicator */}
          <div className="flex items-center gap-2 ml-4 text-xs text-gray-500">
            <span
              className={`w-2 h-2 rounded-full ${
                apiStatus?.status === 'healthy'
                  ? 'bg-emerald-400 animate-pulse-soft'
                  : apiStatus?.status === 'degraded'
                  ? 'bg-yellow-400 animate-pulse-soft'
                  : 'bg-red-400'
              }`}
            />
            {apiStatus?.status === 'healthy'
              ? 'API Connected'
              : apiStatus?.status === 'degraded'
              ? 'Degraded'
              : 'Offline'}
          </div>
        </nav>
      </header>

      {/* ─── Page Content ───────────────────────────────────── */}
      <main className="flex-1 relative">
        {currentPage === 'home' ? (
          <HomePage onNavigateToMap={() => setCurrentPage('map')} apiStatus={apiStatus} />
        ) : (
          <MapPage apiStatus={apiStatus} />
        )}
      </main>

      {/* ─── Footer ─────────────────────────────────────────── */}
      <footer className="text-center text-xs text-gray-600 py-2 border-t border-gray-800">
        GoliTransit v0.1.0 — Hackathon Project
      </footer>
    </div>
  );
}

export default App;
