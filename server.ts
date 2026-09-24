import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  getTotalUSDT,
  getCachedBinanceData,
  updateCachedBinanceData,
  getBinanceLogs,
} from './server/binanceService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// URL de Google Apps Script para cuentas y saldos
const APPSCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbzc2H9UsKIo9P9u4wspPFHKzAWEEoshXt-C2msC6dIQd_p1cq8Zf4gRklEeSZMhs24_Tw/exec';

// URL de Google Apps Script para tasas oficiales BCV (USD / EUR)
const RATES_APPSCRIPT_URL =
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

interface RawBankRecord {
  id_banco: string;
  monto_bs?: string | number;
  'monto_$'?: string | number;
  monto_usd?: string | number;
  monto_dolar?: string | number;
  categoria?: string;
  category?: string;
  fecha_actualizacion?: string;
  cuenta?: string;
  link_actualizar?: string;
}

interface BankAccount {
  id: string;
  bankId: string;
  bankName: string;
  bankShort: string;
  accountType: string;
  accountNumber: string;
  categoria?: string;
  nativeCurrency: 'VES' | 'USD';
  balanceNative: number;
  montoUsd?: number;
  lastSync: string;
  linkActualizar?: string;
}

interface RawRatesResponse {
  tasa_usd?: string;
  tasa_eur?: string;
  fecha_valor?: string;
  tasa_usd_anterior?: string;
  tasa_eur_anterior?: string;
  fecha_tasa_anterior?: string;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Estado en memoria de tasas oficiales BCV y Binance P2P
  let cachedRates = {
    bcv: 853.50,
    bcvUsd: 853.50,
    bcvEur: 976.55,
    binanceP2p: 0,
    fechaValor: '',
    tasaUsdAnterior: 852.42,
    tasaEurAnterior: 978.17,
    fechaTasaAnterior: '',
    lastUpdated: new Date().toISOString(),
  };

  // Función para consultar la tasa en tiempo real de Binance P2P (USDT / VES)
  async function obtenerTasaBinanceP2P(): Promise<number> {
    try {
      const response = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
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
        const res = (await response.json()) as {
          data?: Array<{ adv?: { price?: string } }>;
        };
        if (res && res.data && res.data.length > 0 && res.data[0]?.adv?.price) {
          const parsedPrice = parseFloat(res.data[0].adv.price);
          if (!isNaN(parsedPrice) && parsedPrice > 0) {
            cachedRates.binanceP2p = parsedPrice;
            return parsedPrice;
          }
        }
      }
      return cachedRates.binanceP2p;
    } catch (e) {
      console.log('Error consultando P2P Binance: ' + e);
      return cachedRates.binanceP2p;
    }
  }

  // Archivo para persistencia de cuentas en disco
  const ACCOUNTS_CACHE_FILE = path.join(__dirname, 'server', 'accounts_cache.json');

  function loadCachedAccounts(): BankAccount[] {
    try {
      if (fs.existsSync(ACCOUNTS_CACHE_FILE)) {
        const fileData = fs.readFileSync(ACCOUNTS_CACHE_FILE, 'utf-8');
        const parsed = JSON.parse(fileData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.log('No previous cached accounts file found, using defaults');
    }
    return [
      {
        id: 'bdv',
        bankId: 'bdv',
        bankName: 'BDV',
        bankShort: 'BDV',
        accountType: 'Cuenta Bancaria',
        accountNumber: '04129549022',
        nativeCurrency: 'VES',
        balanceNative: 0,
        lastSync: '',
        linkActualizar: 'https://trigger.macrodroid.com/25be1f4a-0ab8-459e-977c-a6b58d1d3edf/BDV',
      },
      {
        id: 'banesco',
        bankId: 'banesco',
        bankName: 'BANESCO',
        bankShort: 'BANESCO',
        accountType: 'Cuenta Bancaria',
        accountNumber: '04244909232',
        nativeCurrency: 'VES',
        balanceNative: 0,
        lastSync: '',
        linkActualizar: 'https://trigger.macrodroid.com/25be1f4a-0ab8-459e-977c-a6b58d1d3edf/BANESCO',
      },
      {
        id: 'bnc',
        bankId: 'bnc',
        bankName: 'BNC',
        bankShort: 'BNC',
        accountType: 'Cuenta Bancaria',
        accountNumber: '04129549022',
        nativeCurrency: 'VES',
        balanceNative: 0,
        lastSync: '',
        linkActualizar: 'https://trigger.macrodroid.com/25be1f4a-0ab8-459e-977c-a6b58d1d3edf/BNC',
      },
      {
        id: 'bdv-tu-combox-c-a',
        bankId: 'bdv-combox',
        bankName: 'BDV TU COMBOX C.A',
        bankShort: 'BDV TU COMBOX C.A',
        accountType: 'Cuenta Bancaria',
        accountNumber: 'J501298211',
        nativeCurrency: 'VES',
        balanceNative: 0,
        lastSync: '',
        linkActualizar: '',
      },
    ];
  }

  function saveCachedAccounts(accounts: BankAccount[]) {
    try {
      const serverDir = path.dirname(ACCOUNTS_CACHE_FILE);
      if (!fs.existsSync(serverDir)) {
        fs.mkdirSync(serverDir, { recursive: true });
      }
      fs.writeFileSync(ACCOUNTS_CACHE_FILE, JSON.stringify(accounts, null, 2), 'utf-8');
    } catch (e) {
      // Ignorar errores al escribir caché en disco
    }
  }

  // Cache local de cuentas
  let cachedAccounts: BankAccount[] = loadCachedAccounts();

  // Función para obtener tasas oficiales dinámicas desde el Google Apps Script
  async function fetchRatesFromAppScript() {
    try {
      const response = await fetch(RATES_APPSCRIPT_URL, {
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const rawRates = (await response.json()) as RawRatesResponse;
        if (rawRates && (rawRates.tasa_usd || rawRates.tasa_eur)) {
          const usd = rawRates.tasa_usd ? parseAmount(rawRates.tasa_usd) : cachedRates.bcvUsd;
          const eur = rawRates.tasa_eur ? parseAmount(rawRates.tasa_eur) : cachedRates.bcvEur;
          cachedRates = {
            bcv: usd,
            bcvUsd: usd,
            bcvEur: eur,
            binanceP2p: cachedRates.binanceP2p,
            fechaValor: rawRates.fecha_valor || cachedRates.fechaValor,
            tasaUsdAnterior: rawRates.tasa_usd_anterior ? parseAmount(rawRates.tasa_usd_anterior) : cachedRates.tasaUsdAnterior,
            tasaEurAnterior: rawRates.tasa_eur_anterior ? parseAmount(rawRates.tasa_eur_anterior) : cachedRates.tasaEurAnterior,
            fechaTasaAnterior: rawRates.fecha_tasa_anterior || cachedRates.fechaTasaAnterior,
            lastUpdated: new Date().toISOString(),
          };
        }
      }
    } catch {
      // Usar tasas en caché si el script no está disponible temporalmente
    }
    return cachedRates;
  }

  // Función para obtener los datos de bancos desde Google Apps Script
  async function fetchAccountsFromAppScript(): Promise<BankAccount[]> {
    try {
      const response = await fetch(APPSCRIPT_URL, {
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (response.ok) {
        const rawData = (await response.json()) as RawBankRecord[];
        if (Array.isArray(rawData) && rawData.length > 0) {
          const seenIds = new Set<string>();
          cachedAccounts = rawData.map((item, index) => {
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
          saveCachedAccounts(cachedAccounts);
        }
      }
    } catch {
      // Usar datos en caché local si Google Apps Script no responde
    }

    // Asegurar que Binance esté SIEMPRE presente en la lista de bancos
    const binanceData = getCachedBinanceData();
    const binanceIndex = cachedAccounts.findIndex(
      (a) => a.id === 'binance' || a.bankName.toLowerCase().includes('binance')
    );

    if (binanceIndex === -1) {
      cachedAccounts.push({
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
      // Si el saldo de Binance proviene de la API de Binance o es mayor a 0, actualizarlo
      cachedAccounts[binanceIndex].accountNumber = '1272204580';
      cachedAccounts[binanceIndex].accountType = 'ID';
      if (!cachedAccounts[binanceIndex].categoria || cachedAccounts[binanceIndex].categoria === 'Digital') {
        cachedAccounts[binanceIndex].categoria = 'Binance';
      }
      if (binanceData.totalUsd > 0 || binanceData.lastSync) {
        cachedAccounts[binanceIndex].balanceNative = binanceData.totalUsd;
        cachedAccounts[binanceIndex].nativeCurrency = 'USD';
        if (binanceData.lastSync) {
          cachedAccounts[binanceIndex].lastSync = binanceData.lastSync;
        }
      }
    }

    return cachedAccounts;
  }

  // Carga inicial al arrancar: Tasas, Binance P2P y Binance Wallet
  fetchRatesFromAppScript().catch(() => {});
  obtenerTasaBinanceP2P().catch(() => {});
  getTotalUSDT().catch(() => {});

  // Rutas API
  app.get('/api/rates', async (_req, res) => {
    const [rates, p2pPrice] = await Promise.all([
      fetchRatesFromAppScript(),
      obtenerTasaBinanceP2P().catch(() => cachedRates.binanceP2p),
    ]);
    if (p2pPrice > 0) {
      rates.binanceP2p = p2pPrice;
      cachedRates.binanceP2p = p2pPrice;
    }
    res.json({ success: true, rates });
  });

  app.get('/api/rates/binance-p2p', async (_req, res) => {
    const price = await obtenerTasaBinanceP2P();
    res.json({ success: true, price: price || cachedRates.binanceP2p });
  });

  app.post('/api/rates/update', (req, res) => {
    const { bcv, bcvUsd, bcvEur, binanceP2p } = req.body;
    if (bcv !== undefined) cachedRates.bcv = Number(bcv);
    if (bcvUsd !== undefined) cachedRates.bcvUsd = Number(bcvUsd);
    if (bcvEur !== undefined) cachedRates.bcvEur = Number(bcvEur);
    if (binanceP2p !== undefined) cachedRates.binanceP2p = Number(binanceP2p);
    cachedRates.lastUpdated = new Date().toISOString();
    res.json({ success: true, rates: cachedRates });
  });

  // Rutas dedicadas de Binance (calcula Spot + Funding + Simple Earn Flexible)
  app.get('/api/binance/balance', (_req, res) => {
    const data = getCachedBinanceData();
    res.json({ success: true, binance: data });
  });

  app.get('/api/binance/logs', (_req, res) => {
    const logs = getBinanceLogs();
    res.json({ success: true, logs });
  });

  app.post('/api/binance/sync', async (_req, res) => {
    const data = await getTotalUSDT();
    const bIndex = cachedAccounts.findIndex(
      (a) => a.id === 'binance' || a.bankName.toLowerCase().includes('binance')
    );
    if (bIndex !== -1 && data.totalUsd > 0) {
      cachedAccounts[bIndex].balanceNative = data.totalUsd;
      cachedAccounts[bIndex].lastSync = data.lastSync;
    }
    res.json({ success: true, binance: data });
  });

  // Endpoint POST para actualizar saldo desde la web o webhook
  app.post('/api/binance/update-balance', (req, res) => {
    const rawVal = req.body.totalUsd ?? req.body.total ?? req.body.saldo;
    const totalUsd = typeof rawVal === 'string' ? parseFloat(rawVal) : Number(rawVal);
    const breakdown = req.body.breakdown || {
      spotUsd: Number(req.body.spotUsd || req.body.spot || 0),
      fundingUsd: Number(req.body.fundingUsd || req.body.funding || 0),
      flexibleUsd: Number(req.body.flexibleUsd || req.body.flexible || 0),
    };

    if (!isNaN(totalUsd) && totalUsd >= 0) {
      const updated = updateCachedBinanceData(totalUsd, breakdown);
      const bIndex = cachedAccounts.findIndex(
        (a) => a.id === 'binance' || a.bankName.toLowerCase().includes('binance')
      );
      if (bIndex !== -1) {
        cachedAccounts[bIndex].balanceNative = updated.totalUsd;
        cachedAccounts[bIndex].lastSync = updated.lastSync;
      }
      return res.json({ success: true, binance: updated });
    }
    res.status(400).json({ success: false, error: 'Invalid totalUsd' });
  });

  // Endpoint GET rápido para Scriptable o MacroDroid: /api/binance/update?total=123.45
  app.get('/api/binance/update', (req, res) => {
    const rawVal = req.query.total ?? req.query.saldo ?? req.query.totalUsd;
    const totalUsd = typeof rawVal === 'string' ? parseFloat(rawVal) : Number(rawVal);
    if (!isNaN(totalUsd) && totalUsd >= 0) {
      const breakdown = {
        spotUsd: req.query.spot ? parseFloat(String(req.query.spot)) : undefined,
        fundingUsd: req.query.funding ? parseFloat(String(req.query.funding)) : undefined,
        flexibleUsd: req.query.flexible ? parseFloat(String(req.query.flexible)) : undefined,
      };
      const updated = updateCachedBinanceData(totalUsd, breakdown);
      const bIndex = cachedAccounts.findIndex(
        (a) => a.id === 'binance' || a.bankName.toLowerCase().includes('binance')
      );
      if (bIndex !== -1) {
        cachedAccounts[bIndex].balanceNative = updated.totalUsd;
        cachedAccounts[bIndex].lastSync = updated.lastSync;
      }
      return res.json({ success: true, binance: updated });
    }
    res.status(400).json({ success: false, error: 'Proporciona ?total=MONTO' });
  });

  // Consulta en tiempo real a Google Apps Script de saldos, Binance y tasas al entrar/refrescar
  app.get('/api/banks/balances', async (_req, res) => {
    // Sincronizar Binance en segundo plano sin bloquear la respuesta de los bancos
    getTotalUSDT().catch(() => {});

    const [accounts, rates, p2pPrice] = await Promise.all([
      fetchAccountsFromAppScript(),
      fetchRatesFromAppScript(),
      obtenerTasaBinanceP2P().catch(() => cachedRates.binanceP2p),
    ]);

    if (p2pPrice > 0) {
      rates.binanceP2p = p2pPrice;
      cachedRates.binanceP2p = p2pPrice;
    }

    res.json({
      success: true,
      accounts: accounts && accounts.length > 0 ? accounts : cachedAccounts,
      rates,
      serverTime: new Date().toISOString(),
    });
  });

  // Sincronizar un banco individual
  app.post('/api/banks/sync/:id', async (req, res) => {
    const bankId = String(req.params.id).toLowerCase();

    // Si es Binance
    if (bankId === 'binance' || bankId.includes('binance')) {
      const data = await getTotalUSDT();
      const bIndex = cachedAccounts.findIndex(
        (a) => a.id === 'binance' || a.bankName.toLowerCase().includes('binance')
      );
      if (bIndex !== -1 && data.totalUsd > 0) {
        cachedAccounts[bIndex].balanceNative = data.totalUsd;
        cachedAccounts[bIndex].lastSync = data.lastSync;
      }
      return res.json({
        success: true,
        account: cachedAccounts[bIndex],
        accounts: cachedAccounts,
      });
    }

    // Buscar la cuenta en caché
    const account = cachedAccounts.find(
      (a) => a.id === bankId || a.bankId === bankId || a.bankShort.toLowerCase().includes(bankId)
    );

    // Si tiene link de actualización (MacroDroid trigger)
    if (account?.linkActualizar) {
      try {
        await fetch(account.linkActualizar, { method: 'GET', signal: AbortSignal.timeout(6000) });
      } catch (err) {
        console.warn(`Error triggering update link for ${bankId}:`, err);
      }

      // Re-consultar Google Apps Script automáticamente a los 20s para capturar el dato guardado por el teléfono
      setTimeout(() => {
        fetchAccountsFromAppScript().catch(() => {});
      }, 20000);
    }

    // Devolver estado actual
    res.json({ success: true, account, accounts: cachedAccounts });
  });

  // Webhook para que MacroDroid o Google Sheet notifiquen una actualización en tiempo real
  app.all('/api/webhook/bank-updated', async (_req, res) => {
    const accounts = await fetchAccountsFromAppScript();
    res.json({ success: true, message: 'Cuentas actualizadas desde Google Apps Script', accounts });
  });

  // Endpoint para actualizar saldo manualmente y disparar el webhook de Google Apps Script:
  // APPSCRIPT_URL?banco=[nombre banco]&monto=[saldo]
  app.post('/api/banks/update-balance', async (req, res) => {
    const { banco, monto, montoUsd, monto_usd, id } = req.body;
    const numMontoBs = parseFloat(String(monto));
    const numMontoUsd =
      montoUsd !== undefined
        ? parseFloat(String(montoUsd))
        : monto_usd !== undefined
        ? parseFloat(String(monto_usd))
        : undefined;

    if (!banco && !id) {
      return res.status(400).json({ success: false, error: 'Banco o ID requerido' });
    }

    const bankIdentifier = banco || id;

    // 1. Enviar Webhook a Google Apps Script
    let scriptUrl = `${APPSCRIPT_URL}${APPSCRIPT_URL.includes('?') ? '&' : '?'}banco=${encodeURIComponent(
      bankIdentifier
    )}&monto=${encodeURIComponent(numMontoBs)}&monto_bs=${encodeURIComponent(numMontoBs)}`;

    if (numMontoUsd !== undefined && !isNaN(numMontoUsd)) {
      scriptUrl += `&monto_usd=${encodeURIComponent(numMontoUsd)}&monto_$=${encodeURIComponent(
        numMontoUsd
      )}&monto_dolar=${encodeURIComponent(numMontoUsd)}`;
    }

    try {
      await fetch(scriptUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      console.warn('Error enviando webhook a Google Apps Script:', e);
    }

    // 2. Actualizar caché local de inmediato
    const bIndex = cachedAccounts.findIndex(
      (a) =>
        a.id.toLowerCase() === String(bankIdentifier).toLowerCase() ||
        a.bankShort.toLowerCase() === String(bankIdentifier).toLowerCase() ||
        a.bankId.toLowerCase() === String(bankIdentifier).toLowerCase() ||
        (id && a.id.toLowerCase() === String(id).toLowerCase())
    );

    if (bIndex !== -1) {
      if (!isNaN(numMontoBs)) {
        cachedAccounts[bIndex].balanceNative = numMontoBs;
      }
      if (numMontoUsd !== undefined && !isNaN(numMontoUsd)) {
        cachedAccounts[bIndex].montoUsd = numMontoUsd;
      }
      cachedAccounts[bIndex].lastSync = new Date().toISOString();

      if (
        cachedAccounts[bIndex].id === 'binance' ||
        cachedAccounts[bIndex].bankShort.toLowerCase().includes('binance')
      ) {
        updateCachedBinanceData(numMontoBs);
      }
    }

    // 3. Programar re-consulta suave con Google Apps Script
    setTimeout(() => {
      fetchAccountsFromAppScript().catch(() => {});
    }, 10000);

    res.json({
      success: true,
      message: 'Saldo actualizado y webhook enviado',
      accounts: cachedAccounts,
    });
  });

  // Forzar sincronización de ambos servicios
  app.post('/api/banks/sync-all', async (_req, res) => {
    const triggerPromises = cachedAccounts
      .filter((a) => a.linkActualizar)
      .map((a) =>
        fetch(a.linkActualizar!, { method: 'GET' }).catch(() => null)
      );

    if (triggerPromises.length > 0) {
      await Promise.allSettled(triggerPromises);

      // Re-consultar a los 20s
      setTimeout(() => {
        fetchAccountsFromAppScript().catch(() => {});
      }, 20000);
    }

    const [accounts, rates] = await Promise.all([
      fetchAccountsFromAppScript(),
      fetchRatesFromAppScript(),
    ]);

    res.json({ success: true, accounts, rates, lastSync: new Date().toISOString() });
  });

  // Vite development middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api')) {
        return next();
      }
      try {
        const indexHtmlPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexHtmlPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
