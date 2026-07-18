'use client'

import { useEffect, useState } from 'react'
import { Activity, CheckCircle, XCircle, RefreshCw } from 'lucide-react'

interface HealthData {
  status: string
  timestamp: string
  version?: string
  checks?: {
    database?: {
      status: string
      latencyMs?: number
      error?: string
    }
  }
}

export default function AdminHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function checkHealth() {
    setLoading(true)
    setError(null)
    fetch('/api/health')
      .then(async (r) => {
        if (!r.ok) throw new Error('Health check failed')
        return r.json()
      })
      .then(setHealth)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { checkHealth() }, [])

  const isHealthy = health?.status === 'ok' || health?.status === 'healthy'
  const dbStatus = health?.checks?.database?.status
  const dbConnected = dbStatus === 'ok' || dbStatus === 'healthy'
  const dbLatency = health?.checks?.database?.latencyMs

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">System Health</h1>
        <button
          onClick={checkHealth}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-500" />
            <div>
              <p className="font-medium text-red-800">System Unhealthy</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* API Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            {isHealthy ? (
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            ) : (
              <XCircle className="w-6 h-6 text-red-500" />
            )}
            <h3 className="font-semibold text-slate-900">API</h3>
          </div>
          <p className="text-sm text-slate-500">
            Status:{' '}
            <span className={isHealthy ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
              {health?.status || 'Unknown'}
            </span>
          </p>
          {health?.timestamp && (
            <p className="text-xs text-slate-400 mt-1">
              Last checked: {new Date(health.timestamp).toLocaleString()}
            </p>
          )}
        </div>

        {/* Database */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            {dbConnected ? (
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            ) : (
              <XCircle className="w-6 h-6 text-red-500" />
            )}
            <h3 className="font-semibold text-slate-900">Database</h3>
          </div>
          <p className="text-sm text-slate-500">
            Connection:{' '}
            <span className={dbConnected ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
              {dbConnected ? 'Connected' : 'Disconnected'}
            </span>
          </p>
          {dbLatency !== undefined && (
            <p className="text-xs text-slate-400 mt-1">
              Latency: {dbLatency}ms
            </p>
          )}
        </div>

        {/* Deployment */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-6 h-6 text-blue-500" />
            <h3 className="font-semibold text-slate-900">Deployment</h3>
          </div>
          <p className="text-sm text-slate-500">
            Platform: <span className="font-medium text-slate-700">Vercel</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Region: eu-central-1 (Frankfurt)
          </p>
        </div>
      </div>
    </div>
  )
}
