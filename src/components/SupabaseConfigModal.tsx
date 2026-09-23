import React, { useState, useEffect } from 'react';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
} from '../services/supabase';
import { debugLogger, LogEntry } from '../services/debugLogger';
import {
  Database,
  X,
  Check,
  ShieldCheck,
  Terminal,
  Play,
  Trash2,
  Copy,
  AlertCircle,
  RefreshCw,
  Eye,
} from 'lucide-react';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const currentConfig = getSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey);
  const [isSuccess, setIsSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'test' | 'logs'>('config');

  // Test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status: number;
    body: any;
    logs: string[];
  } | null>(null);

  // Live logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsub = debugLogger.subscribe(setLogs);
    return unsub;
  }, []);

  useEffect(() => {
    if (isOpen) {
      const c = getSupabaseConfig();
      setUrl(c.url);
      setAnonKey(c.anonKey);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseConfig(url, anonKey);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onSaved();
    }, 600);
  };

  const runDiagnostics = async () => {
    setTesting(true);
    setTestResult(null);
    saveSupabaseConfig(url, anonKey);
    try {
      const res = await testSupabaseConnection();
      setTestResult(res);
      if (res.success) {
        onSaved();
      }
    } finally {
      setTesting(false);
    }
  };

  const copyLogsToClipboard = () => {
    const text = logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.source}] [${l.level.toUpperCase()}]: ${l.message} ${
            l.details ? JSON.stringify(l.details, null, 2) : ''
          }`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Diagnóstico y Conexión Supabase / Binance
              </h3>
              <p className="text-[11px] text-slate-400">
                Verifica lo que envía y recibe la Edge Function en tiempo real
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-950/80 p-1 rounded-2xl border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'config'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ⚙️ Configuración
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('test')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'test'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            🚀 Prueba en Vivo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'logs'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Logs ({logs.length})</span>
          </button>
        </div>

        {/* Tab 1: Config */}
        {activeTab === 'config' && (
          <form onSubmit={handleSave} className="space-y-3.5 overflow-y-auto pr-1">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Project URL de Supabase (VITE_SUPABASE_URL)
              </label>
              <input
                type="text"
                required
                placeholder="https://htxzsefmejercvwlarfl.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none transition-colors"
              />
              <p className="text-[10px] text-slate-500">
                Coloca la URL base: <code>https://htxzsefmejercvwlarfl.supabase.co</code>
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                Public Anon Key (VITE_SUPABASE_ANON_KEY)
              </label>
              <input
                type="text"
                required
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none font-mono transition-colors"
              />
            </div>

            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3 text-[11px] text-slate-400 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Llaves de Binance</span>
              </div>
              <p>
                Las llaves <code>BINANCE_API_KEY</code> y <code>BINANCE_API_SECRET</code> deben estar configuradas en <strong>Supabase Dashboard ➔ Project Settings ➔ Edge Functions (Secrets)</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  saveSupabaseConfig(url, anonKey);
                  setActiveTab('test');
                  runDiagnostics();
                }}
                className="py-2.5 px-3 text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-xl transition-colors flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Guardar y Probar</span>
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-md shadow-emerald-950 flex items-center justify-center gap-1.5"
              >
                {isSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardado Exitosamente</span>
                  </>
                ) : (
                  <span>Guardar Configuración</span>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Test en Vivo */}
        {activeTab === 'test' && (
          <div className="space-y-3 overflow-y-auto pr-1 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-300 font-semibold">
                Prueba de llamada directa a <code>swift-handler</code>:
              </p>
              <button
                type="button"
                disabled={testing}
                onClick={runDiagnostics}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl shadow transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Consultando Binance...' : 'Ejecutar Diagnóstico'}</span>
              </button>
            </div>

            {testResult && (
              <div className="space-y-3">
                <div
                  className={`p-3 rounded-2xl border ${
                    testResult.success
                      ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs">
                    {testResult.success ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    )}
                    <span>
                      {testResult.success
                        ? `Conexión Exitosa (Status HTTP ${testResult.status})`
                        : `Fallo de Respuesta (Status HTTP ${testResult.status || 'Error Red/CORS'})`}
                    </span>
                  </div>
                </div>

                {/* Resultado Respuesta */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400">
                    Cuerpo de Respuesta de Supabase / Binance:
                  </span>
                  <pre className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-48">
                    {typeof testResult.body === 'object'
                      ? JSON.stringify(testResult.body, null, 2)
                      : String(testResult.body)}
                  </pre>
                </div>

                {/* Traza de ejecución */}
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-400">
                    Traza del Diagnóstico:
                  </span>
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-2.5 space-y-1 font-mono text-[10px] text-slate-300 max-h-36 overflow-y-auto">
                    {testResult.logs.map((msg, i) => (
                      <div key={i} className="leading-tight">
                        {msg}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!testResult && !testing && (
              <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                Pulsa <strong>"Ejecutar Diagnóstico"</strong> para enviar una petición real y ver la respuesta exacta de Supabase y Binance.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Logs en Vivo */}
        {activeTab === 'logs' && (
          <div className="space-y-3 overflow-y-auto pr-1 flex-1 flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-slate-300">
                Historial de eventos y respuestas ({logs.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyLogsToClipboard}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => debugLogger.clearLogs()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Limpiar</span>
                </button>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2.5 space-y-2 overflow-y-auto flex-1 font-mono text-[11px] max-h-80">
              {logs.length === 0 ? (
                <p className="text-slate-600 text-center py-6">No hay logs registrados aún</p>
              ) : (
                logs.map((l) => (
                  <div
                    key={l.id}
                    className={`p-2 rounded-xl border text-[11px] ${
                      l.level === 'error'
                        ? 'bg-rose-950/20 border-rose-800/40 text-rose-300'
                        : l.level === 'warn'
                        ? 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                        : l.level === 'success'
                        ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                        : 'bg-slate-900 border-slate-800/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] opacity-70 mb-0.5">
                      <span className="font-bold">[{l.source}]</span>
                      <span>{l.timestamp}</span>
                    </div>
                    <div className="font-semibold">{l.message}</div>
                    {l.details && (
                      <pre className="mt-1.5 p-1.5 bg-slate-950/90 rounded text-[10px] overflow-x-auto text-slate-400">
                        {typeof l.details === 'object'
                          ? JSON.stringify(l.details, null, 2)
                          : String(l.details)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
