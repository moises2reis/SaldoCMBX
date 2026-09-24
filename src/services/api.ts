import { BankAccount, ExchangeRates } from '../types/dashboard';
import { INITIAL_ACCOUNTS, INITIAL_RATES } from '../constants/initialData';
import { callSupabase } from './supabase';

export { callSupabase };

// URLs públicas de Google Apps Script para funcionamiento estático en GitHub Pages
export const APPSCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzc2H9UsKIo9P9u4wspPFHKzAWEEoshXt-C2msC6dIQd_p1cq8Zf4gRklEeSZMhs24_Tw/exec';

export const RATES_APPSCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbw-Hi0SA7yR6EMhU_dVCVO-H-9_bOQNHMgMTKXDkbctGEvGrFQjLupkJp8haTme08aC/exec';

function parseAmount(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).trim().replace(/Bs\.?/gi, '').replace(/\$/g, '').replace(/€/g, '').trim();
  if (!str) return 0;
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 4) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

// Caching local en el navegador para GitHub Pages
function getLocalBinanceBalance(): { totalUsd: number; lastSync: string } {
  try {
    const saved = localStorage.getItem('gh_pages_binance_data');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return { totalUsd: 0, lastSync: '' };
}

function setLocalBinanceBalance(totalUsd: number) {
  try {
    localStorage.setItem(
      'gh_pages_binance_data',
      JSON.stringify({ totalUsd, lastSync: new Date().toISOString() })
    );
  } catch {}
}

/**
 * Consulta directa a Google Apps Script para tasas BCV (para GitHub Pages y fallback)
 */
export async function fetchRatesDirectly(): Promise<ExchangeRates> {
  let rates: ExchangeRates = { ...INITIAL_RATES };
  try {
    const res = await fetch(RATES_APPSCRIPT_URL);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.tasa_usd || data.tasa_eur)) {
        rates = {
          bcv: parseAmount(data.tasa_usd) || rates.bcv,
          bcvUsd: parseAmount(data.tasa_usd) || rates.bcvUsd,
          bcvEur: parseAmount(data.tasa_eur) || rates.bcvEur,
          binanceP2p: rates.binanceP2p,
          fechaValor: data.fecha_valor || rates.fechaValor,
          tasaUsdAnterior: data.tasa_usd_anterior ? parseAmount(data.tasa_usd_anterior) : undefined,
          tasaEurAnterior: data.tasa_eur_anterior ? parseAmount(data.tasa_eur_anterior) : undefined,
          fechaTasaAnterior: data.fecha_tasa_anterior || undefined,
          lastUpdated: new Date().toISOString(),
        };
      }
    }
  } catch {
    // Usar tasas por defecto
  }

  // Intentar obtener tasa Binance P2P
  try {
    const p2pPrice = await obtenerTasaBinanceP2P();
    if (p2pPrice > 0) {
      rates.binanceP2p = p2pPrice;
    }
  } catch {}

  return rates;
}

async function getOrFetchBinanceBalance(): Promise<{ totalUsd: number; lastSync: string }> {
  // 1. Consultar vía Supabase Edge Function ('swift-handler') con action='balance'
  try {
    const res = await callSupabase<any>('balance', {});
    if (res.success && res.data) {
      const dataObj = res.data.data || res.data;
      const liveBal = Number(
        dataObj.totalUsd ??
          dataObj.saldo ??
          dataObj.balance ??
          dataObj.total ??
          res.data.totalUsd ??
          res.data.saldo ??
          0
      );
      if (liveBal > 0) {
        setLocalBinanceBalance(liveBal);
        return { totalUsd: liveBal, lastSync: new Date().toISOString() };
      } else if (res.data.code === 1000 && liveBal === 0) {
        setLocalBinanceBalance(0);
        return { totalUsd: 0, lastSync: new Date().toISOString() };
      }
    }
  } catch {}

  // 2. Retornar del almacenamiento local en navegador
  return getLocalBinanceBalance();
}

/**
 * Consulta directa a Google Apps Script para cuentas bancarias (para GitHub Pages y fallback)
 */
export async function fetchAccountsDirectly(): Promise<BankAccount[]> {
  try {
    const res = await fetch(APPSCRIPT_URL, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const rawData = await res.json();
      if (Array.isArray(rawData) && rawData.length > 0) {
        const seenIds = new Set<string>();
        const parsedAccounts: BankAccount[] = rawData.map((item, index) => {
          const rawName = String(item.id_banco || '').trim();
          let cleanId =
            rawName.toLowerCase().replace(/[^a-z0-9]/g, '-') || `bank-${index}`;
          if (seenIds.has(cleanId)) {
            cleanId = `${cleanId}-${index}`;
          }
          seenIds.add(cleanId);
          const isBinance = rawName.toLowerCase().includes('binance');
          const rawCategory = item.categoria || item.category || (isBinance ? 'Binance' : 'Banco');
          const rawUsd = item['monto_$'] ?? item.monto_$ ?? item.monto_usd ?? item.monto_dolar;

          return {
            id: cleanId,
            bankId: cleanId,
            bankName: rawName,
            bankShort: rawName,
            accountType: isBinance ? 'Spot, Earn & Flexible' : 'Cuenta Bancaria',
            accountNumber: item.cuenta ? String(item.cuenta).trim() : '',
            categoria: rawCategory ? String(rawCategory).trim() : (isBinance ? 'Binance' : 'Banco'),
            nativeCurrency: isBinance ? 'USD' : 'VES',
            balanceNative: parseAmount(item.monto_bs),
            montoUsd: rawUsd !== undefined ? parseAmount(rawUsd) : undefined,
            lastSync: item.fecha_actualizacion ? String(item.fecha_actualizacion) : '',
            linkActualizar: item.link_actualizar ? String(item.link_actualizar) : '',
          };
        });

        // Asegurar que Binance esté incluido
        const binanceData = getLocalBinanceBalance();
        const bIdx = parsedAccounts.findIndex(
          (a) => a.id === 'binance' || a.bankName.toLowerCase().includes('binance')
        );
        if (bIdx === -1) {
          parsedAccounts.push({
            id: 'binance',
            bankId: 'binance',
            bankName: 'Binance',
            bankShort: 'BINANCE',
            accountType: 'ID',
            accountNumber: '1272204580',
            categoria: 'Binance',
            nativeCurrency: 'USD',
            balanceNative: binanceData.totalUsd,
            montoUsd: binanceData.totalUsd,
            lastSync: binanceData.lastSync || '',
            linkActualizar: '',
          });
        } else {
          if (!parsedAccounts[bIdx].categoria || parsedAccounts[bIdx].categoria === 'Digital') {
            parsedAccounts[bIdx].categoria = 'Binance';
          }
          if (binanceData.totalUsd > 0 && parsedAccounts[bIdx].balanceNative === 0) {
            parsedAccounts[bIdx].balanceNative = binanceData.totalUsd;
          }
          if (binanceData.totalUsd > 0 && (parsedAccounts[bIdx].montoUsd === undefined || parsedAccounts[bIdx].montoUsd === 0)) {
            parsedAccounts[bIdx].montoUsd = binanceData.totalUsd;
          }
        }

        return parsedAccounts;
      }
    }
  } catch (err) {
    console.warn('Error fetching accounts directly from AppScript:', err);
  }

  return [];
}

/**
 * Consulta de Saldos y Tasas (Compatible con Servidor Express y GitHub Pages estático)
 */
export async function fetchBalancesAndRates(): Promise<{
  success: boolean;
  accounts: BankAccount[];
  rates: ExchangeRates;
}> {
  // 1. Intentar vía endpoint local /api con timeout de 4 segundos
  try {
    const res = await fetch('/api/banks/balances', {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.accounts) && data.accounts.length > 0) {
        return data;
      }
    }
  } catch {}

  // 2. Modo Estático o Fallback Directo
  const [accounts, rates] = await Promise.all([
    fetchAccountsDirectly(),
    fetchRatesDirectly(),
  ]);

  return {
    success: true,
    accounts,
    rates,
  };
}

export async function updateRates(newRates: Partial<ExchangeRates>): Promise<ExchangeRates> {
  try {
    const res = await fetch('/api/rates/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRates),
    });
    if (res.ok) {
      const data = await res.json();
      return data.rates;
    }
  } catch {}
  return { ...INITIAL_RATES, ...newRates };
}

export async function fetchRates(): Promise<ExchangeRates | null> {
  try {
    const res = await fetch(`/api/rates?_t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      return data.rates;
    }
  } catch {}
  return fetchRatesDirectly();
}

export async function syncAllAccounts(): Promise<BankAccount[]> {
  try {
    const res = await fetch('/api/banks/sync-all', {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      return data.accounts;
    }
  } catch {}
  return fetchAccountsDirectly();
}

export async function syncSingleBank(
  id: string
): Promise<{ account?: BankAccount; accounts?: BankAccount[] }> {
  try {
    const res = await fetch(`/api/banks/sync/${encodeURIComponent(id)}`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {}

  if (id === 'binance' || id.toLowerCase().includes('binance')) {
    await getOrFetchBinanceBalance();
  }

  const accounts = await fetchAccountsDirectly();
  const account = accounts.find((a) => a.id === id);
  return { account, accounts };
}

/**
 * Actualizar saldo bancario y enviar Webhook a Google Apps Script
 * exe?banco=[nombre banco]&monto=[saldo]
 */
export async function updateBankBalance(payload: {
  banco: string;
  monto: number;
  montoUsd?: number;
  id: string;
}): Promise<{ success: boolean; accounts?: BankAccount[] }> {
  // 1. Guardar localmente para persistencia en GitHub Pages
  if (payload.id === 'binance' || payload.banco.toLowerCase().includes('binance')) {
    setLocalBinanceBalance(payload.monto);
  }

  // 2. Intentar vía endpoint backend si existe
  try {
    const res = await fetch('/api/banks/update-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {}

  // 3. Envío directo del Webhook a Google Apps Script (para GitHub Pages)
  try {
    let directUrl = `${APPSCRIPT_URL}?banco=${encodeURIComponent(payload.banco)}&monto=${encodeURIComponent(
      payload.monto
    )}&monto_bs=${encodeURIComponent(payload.monto)}`;
    if (payload.montoUsd !== undefined) {
      directUrl += `&monto_usd=${encodeURIComponent(payload.montoUsd)}&monto_$=${encodeURIComponent(
        payload.montoUsd
      )}&monto_dolar=${encodeURIComponent(payload.montoUsd)}`;
    }
    await fetch(directUrl, { method: 'GET', mode: 'no-cors' }).catch(() => {});
  } catch (err) {
    console.warn('Error enviando webhook directo a Google Apps Script:', err);
  }

  return { success: true };
}

export async function obtenerTasaBinanceP2P(): Promise<number> {
  // 1. Intentar vía proxy del servidor local
  try {
    const res = await fetch(`/api/rates/binance-p2p?_t=${Date.now()}`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.price === 'number' && data.price > 0) {
        try {
          localStorage.setItem('gh_pages_binance_p2p', String(data.price));
        } catch {}
        return data.price;
      }
    }
  } catch {}

  // 2. Intentar vía Supabase Edge Function ('p2p')
  try {
    const sbRes = await callSupabase<{ price?: number; rate?: number }>('p2p', {});
    if (sbRes.success && sbRes.data) {
      const price = Number(sbRes.data.price || sbRes.data.rate || 0);
      if (price > 0) {
        try {
          localStorage.setItem('gh_pages_binance_p2p', String(price));
        } catch {}
        return price;
      }
    }
  } catch {}

  // 3. Consulta directa P2P de Binance
  try {
    const response = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fiat: 'VES',
        page: 1,
        rows: 1,
        tradeType: 'BUY',
        asset: 'USDT',
        countries: [],
        payTypes: [],
        publisherType: null,
      }),
    });
    if (response.ok) {
      const res = await response.json();
      if (res && res.data && res.data.length > 0 && res.data[0]?.adv?.price) {
        const parsed = parseFloat(res.data[0].adv.price);
        if (parsed > 0) {
          try {
            localStorage.setItem('gh_pages_binance_p2p', String(parsed));
          } catch {}
          return parsed;
        }
      }
    }
  } catch {}

  // 4. Leer del cache local en navegador
  try {
    const saved = localStorage.getItem('gh_pages_binance_p2p');
    if (saved) {
      const parsed = parseFloat(saved);
      if (parsed > 0) return parsed;
    }
  } catch {}

  return 964.80;
}
