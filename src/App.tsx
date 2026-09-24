import React, { useState, useEffect, useCallback } from 'react';
import { BankAccount, ExchangeRates, ForeignCurrency } from './types/dashboard';
import { INITIAL_ACCOUNTS, INITIAL_RATES } from './constants/initialData';
import { fetchBalancesAndRates, syncAllAccounts, syncSingleBank, updateBankBalance } from './services/api';
import { convertValue, isOlderThanMinutes } from './utils/formatters';
import { SummaryHeader } from './components/SummaryHeader';
import { BankListItem } from './components/BankListItem';
import { EditBankBalanceModal } from './components/EditBankBalanceModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Eye, EyeOff } from 'lucide-react';

export default function App() {
  const [rates, setRates] = useState<ExchangeRates>(() => {
    try {
      const saved = localStorage.getItem('cached_exchange_rates');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.bcv || parsed.bcvUsd)) {
          return { ...INITIAL_RATES, ...parsed };
        }
      }
    } catch {}
    return INITIAL_RATES;
  });

  const [foreignCurrency, setForeignCurrency] = useState<ForeignCurrency>(() => {
    try {
      const saved = localStorage.getItem('cached_foreign_currency');
      if (saved === 'USD' || saved === 'EUR' || saved === 'P2P') {
        return saved as ForeignCurrency;
      }
    } catch {}
    return 'USD';
  });

  const [accounts, setAccounts] = useState<BankAccount[]>(() => {
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
  });

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncingBankId, setSyncingBankId] = useState<string | null>(null);
  const [monitoredBankId, setMonitoredBankId] = useState<string | null>(null);
  const [binanceSyncing, setBinanceSyncing] = useState<boolean>(false);
  const [protectionSeconds, setProtectionSeconds] = useState<number>(0);
  const [justUpdatedBankId, setJustUpdatedBankId] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('cached_selected_category');
      if (saved) return saved;
    } catch {}
    return 'todos';
  });

  // Modal para editar saldo bancario individual y disparar webhook
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  // Persistir cuentas en caché local cada vez que cambien
  useEffect(() => {
    try {
      if (accounts && accounts.length > 0) {
        localStorage.setItem('cached_bank_accounts', JSON.stringify(accounts));
      }
    } catch (err) {
      console.warn('Error saving cached bank accounts:', err);
    }
  }, [accounts]);

  // Persistir categoría seleccionada en caché
  useEffect(() => {
    try {
      if (selectedCategory) {
        localStorage.setItem('cached_selected_category', selectedCategory);
      }
    } catch {}
  }, [selectedCategory]);

  // Persistir moneda extranjera seleccionada en caché
  useEffect(() => {
    try {
      if (foreignCurrency) {
        localStorage.setItem('cached_foreign_currency', foreignCurrency);
      }
    } catch {}
  }, [foreignCurrency]);

  // Estado para ocultar/mostrar monto total del encabezado
  const [hideHeaderTotal, setHideHeaderTotal] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('hide_header_total');
      if (saved !== null) return saved === 'true';
      return localStorage.getItem('hide_balances') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleHideHeaderTotal = () => {
    setHideHeaderTotal((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('hide_header_total', String(next));
      } catch {}
      return next;
    });
  };

  // Estado para ocultar/mostrar los saldos individuales de las tarjetas
  const [hideCardBalances, setHideCardBalances] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('hide_card_balances');
      if (saved !== null) return saved === 'true';
      return localStorage.getItem('hide_balances') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleHideCardBalances = () => {
    setHideCardBalances((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('hide_card_balances', String(next));
      } catch {}
      return next;
    });
  };

  // Cargar datos en vivo (Bancos y Tasas Oficiales en cada carga/actualización)
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const data = await fetchBalancesAndRates();

      if (data?.rates) {
        setRates(data.rates);
        try {
          localStorage.setItem('cached_exchange_rates', JSON.stringify(data.rates));
        } catch {}
      }

      if (data?.accounts && data.accounts.length > 0) {
        setAccounts(data.accounts);
        try {
          localStorage.setItem('cached_bank_accounts', JSON.stringify(data.accounts));
        } catch {}
      }
      return data;
    } catch (err) {
      console.warn('Error fetching live data in background:', err);
      return null;
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, []);

  // Cargar datos al entrar a la página (en segundo plano si ya hay caché para inicio instantáneo)
  useEffect(() => {
    const hasCached = !!localStorage.getItem('cached_bank_accounts');
    loadData(hasCached);
  }, [loadData]);

  // Actualización en segundo plano al regresar a la pestaña activa, enfocar o recargar la página
  useEffect(() => {
    const handleActiveEvent = () => {
      if (document.visibilityState === 'visible') {
        loadData(true);
      }
    };

    window.addEventListener('visibilitychange', handleActiveEvent);
    window.addEventListener('focus', handleActiveEvent);
    window.addEventListener('pageshow', handleActiveEvent);

    return () => {
      window.removeEventListener('visibilitychange', handleActiveEvent);
      window.removeEventListener('focus', handleActiveEvent);
      window.removeEventListener('pageshow', handleActiveEvent);
    };
  }, [loadData]);

  // Manejador del temporizador de 20 segundos de protección global
  useEffect(() => {
    if (protectionSeconds <= 0) return;
    const timer = setInterval(() => {
      setProtectionSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Al culminar los 20 segundos, recargar datos desde Apps Script
          const currentBank = syncingBankId;
          setSyncingBankId(null);

          loadData(true).then((data) => {
            if (currentBank && data?.accounts) {
              const updated = data.accounts.find((a) => a.id === currentBank);
              // Si la fecha es reciente (< 2 minutos), celebrar actualización
              if (updated && !isOlderThanMinutes(updated.lastSync, 2)) {
                setJustUpdatedBankId(currentBank);
                setTimeout(() => setJustUpdatedBankId(null), 3000);
                setMonitoredBankId(null);
              } else if (currentBank) {
                // Si la fecha aún supera los 2 minutos, activar reintentos inteligentes
                setMonitoredBankId(currentBank);
              }
            }
          });

          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [protectionSeconds, syncingBankId, loadData]);

  // Reintentos inteligentes: si se acaba de actualizar un saldo y los minutos aún superan 2 minutos,
  // consultar a Google Apps Script cada 5 segundos hasta que se refleje la actualización
  useEffect(() => {
    if (!monitoredBankId) return;

    let attempts = 0;
    const maxAttempts = 10; // Hasta 50 segundos de reintentos silenciosos

    const interval = setInterval(async () => {
      attempts += 1;
      const data = await loadData(true);
      if (data?.accounts) {
        const acc = data.accounts.find((a) => a.id === monitoredBankId);
        if (acc && !isOlderThanMinutes(acc.lastSync, 2)) {
          // ¡Actualización fresca detectada desde Google Sheet / Apps Script!
          setJustUpdatedBankId(monitoredBankId);
          setTimeout(() => setJustUpdatedBankId(null), 3000);
          setMonitoredBankId(null);
          clearInterval(interval);
          return;
        }
      }

      if (attempts >= maxAttempts) {
        setMonitoredBankId(null);
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [monitoredBankId, loadData]);

  // Tasa activa según la moneda seleccionada (USD, EUR o P2P)
  const bcvUsdRate = rates.bcvUsd || rates.bcv || 853.50;
  const bcvEurRate = rates.bcvEur || 976.55;
  const binanceP2pRate = rates.binanceP2p && rates.binanceP2p > 0 ? rates.binanceP2p : 964.80;

  const activeRate =
    foreignCurrency === 'USD'
      ? bcvUsdRate
      : foreignCurrency === 'EUR'
      ? bcvEurRate
      : binanceP2pRate;

  // Extraer categorías dinámicas con conteo de bancos
  const categories = React.useMemo(() => {
    const catMap = new Map<string, number>();
    accounts.forEach((acc) => {
      const cat = (acc.categoria || 'Banco').trim();
      const normalized = cat.toLowerCase();
      catMap.set(normalized, (catMap.get(normalized) || 0) + 1);
    });

    const list: { id: string; label: string; count: number }[] = [
      { id: 'todos', label: 'Todos', count: accounts.length },
    ];

    catMap.forEach((count, catKey) => {
      const label =
        catKey === 'banco'
          ? 'Bancos'
          : catKey === 'efectivo'
          ? 'Efectivo'
          : catKey === 'binance'
          ? 'Binance'
          : catKey === 'digital'
          ? 'Digital / Cripto'
          : catKey.charAt(0).toUpperCase() + catKey.slice(1);
      list.push({ id: catKey, label, count });
    });

    return list;
  }, [accounts]);

  // Cuentas filtradas por categoría seleccionada
  const filteredAccounts = React.useMemo(() => {
    if (selectedCategory === 'todos') return accounts;
    return accounts.filter(
      (a) => (a.categoria || 'banco').trim().toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [accounts, selectedCategory]);

  const currentCategoryLabel = React.useMemo(() => {
    const found = categories.find((c) => c.id === selectedCategory);
    return found ? found.label : 'Todos';
  }, [categories, selectedCategory]);

  // Calcular totales consolidados dinámicos según la categoría seleccionada (incluyendo efectivo en Bs y $)
  const { totalBs, totalForeign } = React.useMemo(() => {
    let bs = 0;
    filteredAccounts.forEach((acc) => {
      const isEfectivo = acc.categoria?.trim().toLowerCase() === 'efectivo';
      if (isEfectivo) {
        const bsPart = acc.balanceNative || 0;
        const usdPart = (acc.montoUsd || 0) * activeRate;
        bs += bsPart + usdPart;
      } else if (acc.nativeCurrency === 'VES') {
        bs += acc.balanceNative;
      } else if (acc.nativeCurrency === 'USD') {
        bs += convertValue(acc.balanceNative, 'USD', 'VES', activeRate);
      } else if (acc.nativeCurrency === 'EUR') {
        bs += convertValue(acc.balanceNative, 'EUR', 'VES', activeRate);
      }
    });

    const foreign = activeRate > 0 ? bs / activeRate : 0;
    return { totalBs: bs, totalForeign: foreign };
  }, [filteredAccounts, activeRate]);

  const handleRefresh = async () => {
    setIsSyncing(true);
    try {
      const updatedAccounts = await syncAllAccounts();
      if (updatedAccounts && updatedAccounts.length > 0) {
        setAccounts(updatedAccounts);
      }
      const freshData = await fetchBalancesAndRates();
      if (freshData?.rates) {
        setRates(freshData.rates);
      }
      if (freshData?.accounts && freshData.accounts.length > 0) {
        setAccounts(freshData.accounts);
      }
    } catch (err) {
      console.warn('Error during manual refresh:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncSingleBank = async (bankId: string) => {
    const isBinance =
      bankId === 'binance' || bankId.toLowerCase().includes('binance');

    // 1. Si es Binance, sincronizar inmediatamente vía API / Edge Function sin temporizador de 30s
    if (isBinance) {
      if (binanceSyncing) return;
      setBinanceSyncing(true);
      try {
        const res = await syncSingleBank(bankId);
        if (res.accounts && res.accounts.length > 0) {
          setAccounts(res.accounts);
        } else if (res.account) {
          setAccounts((prev) =>
            prev.map((a) =>
              a.id === bankId || a.bankName.toLowerCase().includes('binance')
                ? { ...a, ...res.account! }
                : a
            )
          );
        }
        setJustUpdatedBankId(bankId);
        setTimeout(() => setJustUpdatedBankId(null), 2500);
      } catch (err) {
        console.warn(`Error syncing Binance immediately:`, err);
      } finally {
        setBinanceSyncing(false);
      }
      return;
    }

    // 2. Si son bancos tradicionales venezolanos con MacroDroid SMS (20s)
    if (protectionSeconds > 0) return;

    setSyncingBankId(bankId);
    setProtectionSeconds(20);

    try {
      // Disparar MacroDroid si existe link para este banco
      const targetAccount = accounts.find((a) => a.id === bankId);
      if (targetAccount?.linkActualizar) {
        fetch(targetAccount.linkActualizar, { method: 'GET', mode: 'no-cors' }).catch(() => {});
      }

      const res = await syncSingleBank(bankId);
      if (res.accounts && res.accounts.length > 0) {
        setAccounts(res.accounts);
      } else if (res.account) {
        setAccounts((prev) =>
          prev.map((a) => (a.id === bankId ? { ...a, ...res.account! } : a))
        );
      }
    } catch (err) {
      console.warn(`Error syncing single bank ${bankId}:`, err);
    }
  };

  // Guardar saldo manual y disparar webhook a Google Apps Script
  const handleSaveBankBalance = async (
    bankName: string,
    monto: number,
    bankId: string,
    montoUsd?: number
  ) => {
    try {
      // Actualizar optimistamente el estado visual
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === bankId
            ? {
                ...a,
                balanceNative: monto,
                montoUsd: montoUsd !== undefined ? montoUsd : a.montoUsd,
                lastSync: new Date().toISOString(),
              }
            : a
        )
      );

      // Enviar al backend / webhook
      const res = await updateBankBalance({
        banco: bankName,
        monto,
        montoUsd,
        id: bankId,
      });

      if (res.accounts && res.accounts.length > 0) {
        setAccounts(res.accounts);
      }
    } catch (err) {
      console.warn('Error updating balance and sending webhook:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950 px-4 pb-24 sm:pb-28">
      <div className="max-w-2xl mx-auto">
        {/* Encabezado fijo / estático: Nombre, Tasas y Totales */}
        <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md pt-4 sm:pt-6 pb-2.5 space-y-3 -mx-4 px-4 shadow-lg shadow-slate-950/40">
          {/* Encabezado: Total en Dólares ($) en verde arriba, Total en Bs en gris abajo */}
          <SummaryHeader
            totalBs={totalBs}
            totalForeign={totalForeign}
            foreignCurrency={foreignCurrency}
            onSelectForeignCurrency={setForeignCurrency}
            bcvUsd={bcvUsdRate}
            bcvEur={bcvEurRate}
            binanceP2p={binanceP2pRate}
            fechaValor={rates.fechaValor}
            isSyncing={isSyncing}
            hideBalances={hideHeaderTotal}
            onToggleHideBalances={handleToggleHideHeaderTotal}
            categoryLabel={currentCategoryLabel}
          />

          {/* Botón / Banner de instalación PWA para iOS y Android */}
          <PWAInstallButton />
        </div>

        {/* Lista compacta y limpia de cuentas */}
        <div className="space-y-2.5 pt-4 pb-6">
          <div className="px-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Lista de Saldos
              </h2>
              <button
                type="button"
                onClick={handleToggleHideCardBalances}
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-md transition-colors border border-transparent hover:border-slate-800 flex items-center justify-center"
                title={hideCardBalances ? 'Mostrar saldos de tarjetas' : 'Ocultar saldos de tarjetas'}
                aria-label={hideCardBalances ? 'Mostrar saldos de tarjetas' : 'Ocultar saldos de tarjetas'}
              >
                {hideCardBalances ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            {isSyncing && (
              <span className="text-[10px] text-emerald-400 font-mono animate-pulse">
                Sincronizando...
              </span>
            )}
          </div>

          <div className="space-y-2">
            {filteredAccounts.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500 font-mono">
                No hay cuentas en esta categoría
              </div>
            ) : (
              filteredAccounts.map((acc) => {
                const isBinanceAcc =
                  acc.id === 'binance' ||
                  acc.bankName.toLowerCase().includes('binance') ||
                  acc.bankShort.toLowerCase().includes('binance');

                return (
                  <BankListItem
                    key={acc.id}
                    account={acc}
                    activeRate={activeRate}
                    bcvUsdRate={bcvUsdRate}
                    bcvEurRate={bcvEurRate}
                    hideBalances={hideCardBalances}
                    isSyncing={
                      isBinanceAcc
                        ? binanceSyncing
                        : syncingBankId === acc.id && protectionSeconds > 0
                    }
                    isBlocked={
                      !isBinanceAcc &&
                      syncingBankId !== null &&
                      syncingBankId !== acc.id &&
                      protectionSeconds > 0
                    }
                    protectionSeconds={isBinanceAcc ? 0 : protectionSeconds}
                    justUpdated={justUpdatedBankId === acc.id}
                    onSync={handleSyncSingleBank}
                    onEditBalance={setEditingAccount}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Ventana Modal para actualizar con macro o de forma manual */}
      <EditBankBalanceModal
        isOpen={editingAccount !== null}
        account={editingAccount}
        onClose={() => setEditingAccount(null)}
        onSave={handleSaveBankBalance}
        onSyncMacro={handleSyncSingleBank}
        isSyncingMacro={
          syncingBankId === editingAccount?.id ||
          (editingAccount?.id === 'binance' && binanceSyncing)
        }
        protectionSeconds={protectionSeconds}
        isBlocked={protectionSeconds > 0 && syncingBankId !== editingAccount?.id}
      />

      {/* Indicador de estado Offline */}
      <OfflineIndicator />

      {/* Menú inferior flotante de Categorías tipo Isla en Negro Vehículo */}
      {categories.length > 1 && (
        <div className="fixed bottom-3 sm:bottom-4 left-0 right-0 z-40 px-3 flex justify-center pointer-events-none">
          <div className="pointer-events-auto max-w-[96vw] sm:max-w-xl overflow-x-auto p-1.5 bg-black border border-neutral-800/90 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.95)] flex items-center gap-1.5 no-scrollbar">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 sm:flex-1 py-1.5 sm:py-2 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 whitespace-nowrap select-none ${
                    isActive
                      ? 'bg-neutral-900 text-emerald-400 border border-neutral-700 shadow-md ring-1 ring-emerald-500/20'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900/60 border border-transparent'
                  }`}
                >
                  <span className="whitespace-nowrap tracking-tight">{cat.label}</span>
                  <span
                    className={`text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-full font-mono font-medium shrink-0 ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-neutral-900 text-neutral-500 border border-neutral-800'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
