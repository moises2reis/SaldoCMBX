// ============================================================
// SERVICIO DE BALANCE BINANCE VÍA SUPABASE EDGE FUNCTION (BRASIL)
// ============================================================
const SUPABASE_FUNCTION_URL = 'https://htxzsefmejercvwlarfl.supabase.co/functions/v1/swift-handler';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0eHpzZWZtZWplcmN2d2xhcmZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyMzE2NjIsImV4cCI6MjEwNDgwNzY2Mn0.oxjaY99j5dvFWfOPiXSVCigc1MKKLxTXMjNB1m_IxVw';

export interface BinanceBalanceData {
  totalUsd: number;
  spotUsd: number;
  fundingUsd: number;
  flexibleUsd: number;
  lastSync: string;
  status: 'ok' | 'error' | 'synced';
  errorMsg?: string;
  logs?: string[];
}

let syncLogs: string[] = [];

function addLog(msg: string) {
  const time = new Date().toLocaleTimeString('es-VE', { hour12: false });
  const entry = `[${time}] ${msg}`;
  syncLogs.unshift(entry);
  if (syncLogs.length > 50) syncLogs.pop();
  console.log(`[BinanceService] ${entry}`);
}

let cachedBinanceData: BinanceBalanceData = {
  totalUsd: 0,
  spotUsd: 0,
  fundingUsd: 0,
  flexibleUsd: 0,
  lastSync: '',
  status: 'ok',
};

/**
 * Consulta el saldo actual consolidado de Binance a través de Supabase en Brasil (sa-east-1).
 */
export async function getTotalUSDT(): Promise<BinanceBalanceData> {
  addLog('→ Consultando saldo Binance a través de Supabase Edge Function (Brasil)...');

  try {
    const res = await fetch(SUPABASE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'x-region': 'sa-east-1',
      },
      body: JSON.stringify({ action: 'balance' }),
      signal: AbortSignal.timeout(12000),
    });

    const data = await res.json();

    if (data.code === 1000 && data.data && typeof data.data.totalUsd === 'number') {
      const roundedTotal = Math.round(data.data.totalUsd * 100) / 100;
      addLog(`✔ Saldo obtenido exitosamente desde Supabase: $${roundedTotal} USDT`);
      if (Array.isArray(data.data.logs)) {
        data.data.logs.forEach((l: string) => addLog(`   • ${l}`));
      }

      cachedBinanceData = {
        totalUsd: roundedTotal,
        spotUsd: Math.round((data.data.spotUsd || 0) * 100) / 100,
        fundingUsd: Math.round((data.data.fundingUsd || 0) * 100) / 100,
        flexibleUsd: Math.round((data.data.flexibleUsd || 0) * 100) / 100,
        lastSync: new Date().toISOString(),
        status: 'synced',
        errorMsg: undefined,
        logs: [...syncLogs],
      };
      return cachedBinanceData;
    }

    if (data.code === -1 && data.message?.includes('Acción no válida')) {
      addLog('ℹ Supabase Edge Function respondió: "Acción no válida: balance".');
      addLog('ℹ Pega la función balance en swift-handler dentro de tu panel de Supabase.');
      cachedBinanceData.errorMsg = 'Agrega la acción balance a tu Edge Function en Supabase.';
    } else {
      addLog(`✖ Supabase error: ${data.message || JSON.stringify(data)}`);
      cachedBinanceData.errorMsg = data.message;
    }
  } catch (err: any) {
    addLog(`✖ Error conectando a Supabase Edge Function: ${err.message}`);
    cachedBinanceData.errorMsg = err.message;
  }

  cachedBinanceData.logs = [...syncLogs];
  return cachedBinanceData;
}

export function getCachedBinanceData(): BinanceBalanceData {
  return { ...cachedBinanceData, logs: [...syncLogs] };
}

export function getBinanceLogs(): string[] {
  return [...syncLogs];
}

export function updateCachedBinanceData(
  totalUsd: number,
  breakdown?: { spotUsd?: number; fundingUsd?: number; flexibleUsd?: number }
): BinanceBalanceData {
  addLog(`✔ Saldo actualizado: $${totalUsd} USDT`);
  cachedBinanceData = {
    totalUsd: Math.round(totalUsd * 100) / 100,
    spotUsd: breakdown?.spotUsd !== undefined ? Math.round(breakdown.spotUsd * 100) / 100 : cachedBinanceData.spotUsd,
    fundingUsd: breakdown?.fundingUsd !== undefined ? Math.round(breakdown.fundingUsd * 100) / 100 : cachedBinanceData.fundingUsd,
    flexibleUsd: breakdown?.flexibleUsd !== undefined ? Math.round(breakdown.flexibleUsd * 100) / 100 : cachedBinanceData.flexibleUsd,
    lastSync: new Date().toISOString(),
    status: 'synced',
    errorMsg: undefined,
    logs: [...syncLogs],
  };
  return cachedBinanceData;
}
