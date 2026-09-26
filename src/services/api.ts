import { BankAccount, ExchangeRates } from '../types/dashboard';
import { INITIAL_ACCOUNTS, INITIAL_RATES } from '../constants/initialData';
import { callSupabase } from './supabase';

export { callSupabase };

// URLs públicas de Google Apps Script para funcionamiento estático en GitHub Pages
export const APPSCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzc2H9UsKIo9P9u4wspPFHKzAWEEoshXt-C2msC6dIQd_p1cq8Zf4gRklEeSZMhs24_Tw/exec';

export const RATES_APPSCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbw-Hi0SA7yR6EMhU_dVCVO-H-9_bOQNHMgMTKXDkbctGEvGrFQjLupkJp8haTme08aC/exec';

function normalizeName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Fusiona de forma segura cualquier lista de cuentas con la lista maestra base (INITIAL_ACCOUNTS).
 * Garantiza que NUNCA desaparezcan los bancos tradicionales ni el efectivo aunque la API falle.
 */
export function mergeAccountsWithMaster(
  incomingList: BankAccount[] = [],
  previousList: BankAccount[] = []
): BankAccount[] {
  // Mapa de todas las cuentas maestras por id normalizado
  const masterMap = new Map<string, BankAccount>();

  // 1. Inicializar con la plantilla maestra
  INITIAL_ACCOUNTS.forEach((acc) => {
    masterMap.set(acc.id, { ...acc });
    masterMap.set(normalizeName(acc.bankName), { ...acc });
  });

  // 2. Incorporar datos previos si existen
  previousList.forEach((prev) => {
    const key = masterMap.has(prev.id)
      ? prev.id
      : masterMap.has(normalizeName(prev.bankName))
      ? normalizeName(prev.bankName)
      : null;

    if (key) {
      const existing = masterMap.get(key)!;
      masterMap.set(existing.id, {
        ...existing,
        ...prev,
        // Proteger categoría original
        categoria: prev.categoria || existing.categoria,
      });
    } else {
      masterMap.set(prev.id, { ...prev });
    }
  });

  // 3. Aplicar actualizaciones entrantes (de Google Apps Script, Supabase o usuario)
  incomingList.forEach((inc) => {
    const normName = normalizeName(inc.bankName || inc.bankShort || inc.id);
    let matchedKey: string | null = null;

    if (masterMap.has(inc.id)) {
      matchedKey = inc.id;
    } else if (masterMap.has(normName)) {
      matchedKey = normName;
    } else {
      // Buscar coincidencia parcial (ej. 'bdv' dentro de 'bdv-tu-combox')
      for (const [k, v] of masterMap.entries()) {
        if (normalizeName(v.bankName) === normName || normalizeName(v.id) === normName) {
          matchedKey = k;
          break;
        }
      }
    }

    if (matchedKey) {
      const existing = masterMap.get(matchedKey)!;
      const updated: BankAccount = {
        ...existing,
        ...inc,
        id: existing.id, // Mantener id canónico
        bankId: existing.bankId || inc.bankId || existing.id,
        bankName: inc.bankName || existing.bankName,
        categoria: inc.categoria || existing.categoria,
        accountNumber: inc.accountNumber || existing.accountNumber,
        linkActualizar: inc.linkActualizar || existing.linkActualizar,
      };

      if (inc.balanceNative !== undefined && !isNaN(inc.balanceNative)) {
        updated.balanceNative = inc.balanceNative;
      }
      if (inc.montoUsd !== undefined && !isNaN(inc.montoUsd)) {
        updated.montoUsd = inc.montoUsd;
      }
      if (inc.lastSync) {
        updated.lastSync = inc.lastSync;
      }

      masterMap.set(existing.id, updated);
    } else if (inc.id && inc.bankName) {
      // Cuenta extra no predeterminada
      masterMap.set(inc.id, { ...inc });
    }
  });

  // 4. Reconstruir lista única respetando el orden de INITIAL_ACCOUNTS primero
  const result: BankAccount[] = [];
  const addedIds = new Set<string>();

  INITIAL_ACCOUNTS.forEach((base) => {
    const item = masterMap.get(base.id);
    if (item && !addedIds.has(item.id)) {
      result.push(item);
      addedIds.add(item.id);
    }
  });

  masterMap.forEach((item) => {
    if (!addedIds.has(item.id)) {
      result.push(item);
      addedIds.add(item.id);
    }
  });

  return result;
}

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

function getLocalCachedAccounts(): BankAccount[] {
  try {
    const saved = localStorage.getItem('cached_bank_accounts');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return INITIAL_ACCOUNTS;
}

export function clearBankCache() {
  try {
    localStorage.removeItem('cached_bank_accounts');
    localStorage.removeItem('cached_exchange_rates');
    localStorage.removeItem('gh_pages_binance_data');
    localStorage.removeItem('gh_pages_binance_p2p');
  } catch {}
}

/**
 * Consulta directa a Google Apps Script para tasas BCV (para GitHub Pages y fallback)
 */
export async function fetchRatesDirectly(forceFresh: boolean = false): Promise<ExchangeRates> {
  let rates: ExchangeRates = { ...INITIAL_RATES };
  try {
    const url = forceFresh
      ? `${RATES_APPSCRIPT_URL}?fresh=true&_t=${Date.now()}`
      : `${RATES_APPSCRIPT_URL}?_t=${Date.now()}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
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

export async function getOrFetchBinanceBalance(): Promise<{ totalUsd: number; lastSync: string }> {
  // 1. Consultar vía Supabase Edge Function ('swift-handler') con action='balance'
  try {
    const res = await callSupabase<any>('balance', {});
    if (res.success && res.data) {
      const rawData = res.data;
      const dataObj = rawData.data || rawData.binance || rawData;
      const rawBal =
        dataObj.totalUsd ??
        dataObj.saldo ??
        dataObj.balance ??
        dataObj.total ??
        rawData.totalUsd ??
        rawData.saldo;

      if (rawBal !== undefined && rawBal !== null) {
        const liveBal = Number(rawBal);
        if (!isNaN(liveBal)) {
          const rounded = Math.round(liveBal * 100) / 100;
          setLocalBinanceBalance(rounded);
          return { totalUsd: rounded, lastSync: new Date().toISOString() };
        }
      }
    }
  } catch (err) {
    console.warn('Error querying Supabase for Binance balance:', err);
  }

  // 2. Retornar del almacenamiento local en navegador
  return getLocalBinanceBalance();
}

/**
 * Consulta directa a Google Apps Script para cuentas bancarias (para GitHub Pages y fallback)
 */
export async function fetchAccountsDirectly(forceFresh: boolean = false): Promise<BankAccount[]> {
  const cached = forceFresh ? [] : getLocalCachedAccounts();
  try {
    const url = forceFresh
      ? `${APPSCRIPT_URL}?fresh=true&_t=${Date.now()}`
      : `${APPSCRIPT_URL}?_t=${Date.now()}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      signal: AbortSignal.timeout(10000),
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
          const rawCategory = item.categoria || item.category || (isBinance ? 'Binance' : 'Bancos');
          const rawUsd = item['monto_$'] ?? item.monto_$ ?? item.monto_usd ?? item.monto_dolar;

          return {
            id: cleanId,
            bankId: cleanId,
            bankName: rawName,
            bankShort: rawName,
            accountType: isBinance ? 'Spot, Earn & Flexible' : (rawCategory === 'Efectivo' ? 'Efectivo' : 'Cuenta Bancaria'),
            accountNumber: item.cuenta ? String(item.cuenta).trim() : '',
            categoria: rawCategory ? String(rawCategory).trim() : (isBinance ? 'Binance' : 'Bancos'),
            nativeCurrency: isBinance ? 'USD' : 'VES',
            balanceNative: parseAmount(item.monto_bs),
            montoUsd: rawUsd !== undefined && rawUsd !== '' ? parseAmount(rawUsd) : undefined,
            lastSync: item.fecha_actualizacion ? String(item.fecha_actualizacion) : '',
            linkActualizar: item.link_actualizar ? String(item.link_actualizar) : '',
          };
        });

        return mergeAccountsWithMaster(parsedAccounts, cached);
      }
    }
  } catch (err) {
    console.warn('Error fetching accounts directly from AppScript:', err);
  }

  // Fallback seguro: Retornar cuentas cacheadas fusionadas con la lista maestra
  return mergeAccountsWithMaster([], cached.length > 0 ? cached : getLocalCachedAccounts());
}

/**
 * Consulta de Saldos y Tasas (Compatible con Servidor Express y GitHub Pages estático)
 */
export async function fetchBalancesAndRates(forceFresh: boolean = false): Promise<{
  success: boolean;
  accounts: BankAccount[];
  rates: ExchangeRates;
}> {
  if (forceFresh) {
    clearBankCache();
  }

  // 1. Intentar vía endpoint local /api con timeout adecuado
  try {
    const url = forceFresh ? `/api/banks/balances?fresh=true&_t=${Date.now()}` : `/api/banks/balances?_t=${Date.now()}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data && Array.isArray(data.accounts) && data.accounts.length >= 3) {
          const merged = mergeAccountsWithMaster(data.accounts, forceFresh ? [] : getLocalCachedAccounts());
          try {
            localStorage.setItem('cached_bank_accounts', JSON.stringify(merged));
            if (data.rates) {
              localStorage.setItem('cached_exchange_rates', JSON.stringify(data.rates));
            }
          } catch {}
          return {
            success: true,
            accounts: merged,
            rates: data.rates || INITIAL_RATES,
          };
        }
      }
    }
  } catch {}

  // 2. Modo Estático (GitHub Pages) o Fallback: Consultar Apps Script + Tasas + Supabase Binance en paralelo
  const [directAccounts, rates, binanceData] = await Promise.all([
    fetchAccountsDirectly(forceFresh),
    fetchRatesDirectly(forceFresh),
    getOrFetchBinanceBalance(),
  ]);

  // Fusionar siempre de manera segura con la plantilla maestra
  const accounts = mergeAccountsWithMaster(directAccounts, forceFresh ? [] : getLocalCachedAccounts());

  // Actualizar el saldo y fecha de sincronización de Binance obtenido desde Supabase
  const bIdx = accounts.findIndex(
    (a) => a.id === 'binance' || a.bankName.toLowerCase().includes('binance')
  );
  if (bIdx !== -1) {
    if (binanceData.totalUsd > 0 || binanceData.lastSync) {
      accounts[bIdx].balanceNative = binanceData.totalUsd;
      accounts[bIdx].montoUsd = binanceData.totalUsd;
      if (binanceData.lastSync) {
        accounts[bIdx].lastSync = binanceData.lastSync;
      }
    }
  }

  try {
    localStorage.setItem('cached_bank_accounts', JSON.stringify(accounts));
    localStorage.setItem('cached_exchange_rates', JSON.stringify(rates));
  } catch {}

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
  const isBinance = id === 'binance' || id.toLowerCase().includes('binance');

  // Si es Binance, consultar en vivo vía Supabase Edge Function
  if (isBinance) {
    const binanceData = await getOrFetchBinanceBalance();
    const accounts = await fetchAccountsDirectly();
    const bIdx = accounts.findIndex(
      (a) => a.id === 'binance' || a.bankName.toLowerCase().includes('binance')
    );
    if (bIdx !== -1) {
      accounts[bIdx].balanceNative = binanceData.totalUsd;
      accounts[bIdx].montoUsd = binanceData.totalUsd;
      accounts[bIdx].lastSync = binanceData.lastSync || new Date().toISOString();
      return { account: accounts[bIdx], accounts };
    }
  }

  try {
    const res = await fetch(`/api/banks/sync/${encodeURIComponent(id)}`, {
      method: 'POST',
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {}

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
