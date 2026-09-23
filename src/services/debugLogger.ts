export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  source: 'Supabase' | 'Binance' | 'AppScript' | 'System';
  message: string;
  details?: any;
}

type LogListener = (logs: LogEntry[]) => void;

class DebugLoggerService {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();
  private maxLogs = 100;

  constructor() {
    this.addLog('info', 'System', 'Sistema de diagnóstico y logs inicializado');
  }

  addLog(
    level: LogEntry['level'],
    source: LogEntry['source'],
    message: string,
    details?: any
  ): LogEntry {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString('es-VE', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }),
      level,
      source,
      message,
      details,
    };

    this.logs = [entry, ...this.logs.slice(0, this.maxLogs - 1)];
    console.log(`[${entry.source}] [${entry.level.toUpperCase()}] ${entry.message}`, details || '');
    this.notify();
    return entry;
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    this.notify();
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener(this.getLogs());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const current = this.getLogs();
    this.listeners.forEach((l) => l(current));
  }
}

export const debugLogger = new DebugLoggerService();
