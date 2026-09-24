import React, { useState, useEffect, useCallback } from 'react';
import { BankAccount, ExchangeRates, ForeignCurrency } from './types/dashboard';
import { INITIAL_ACCOUNTS, INITIAL_RATES } from './constants/initialData';
import { fetchBalancesAndRates, syncAllAccounts, syncSingleBank, updateBankBalance } from './services/api';
import { convertValue } from './utils/formatters';
import { SummaryHeader } from './components/SummaryHeader';
import { BankListItem } from './components/BankListItem';
import { EditBankBalanceModal } from './components/EditBankBalanceModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

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
  const [foreignCurrency, setForeignCurrency] = useState<ForeignCurrency>('USD');
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
  const [binanceSyncing, setBinanceSyncing] = useState<boolean>(false);
  const [protectionSeconds, setProtectionSeconds] = useState<number>(0);
  const [justUpdatedBankId, setJustUpdatedBankId] = useState<string | null>(null);

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

  // Estado para ocultar/mostrar montos (privacidad)
  const [hideBalances, setHideBalances] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hide_balances') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleHideBalances = () => {
    setHideBalances((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('hide_balances', String(next));
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
      }
    } catch (err) {
      console.warn('Error fetching live data:', err);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, []);

  // Cargar datos al entrar a la página (en segundo plano si ya hay caché)
  useEffect(() => {
    const hasCached = !!localStorage.getItem('cached_bank_accounts');
    loadData(hasCached);
  }, [loadData]);

  // Manejador del temporizador de 30 segundos de protección global
  useEffect(() => {
    if (protectionSeconds <= 0) return;
    const timer = setInterval(() => {
      setProtectionSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Al culminar los 30 segundos, recargar datos y liberar bloqueo
          loadData(true);
          if (syncingBankId) {
            setJustUpdatedBankId(syncingBankId);
            setTimeout(() => setJustUpdatedBankId(null), 3000);
          }
          setSyncingBankId(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [protectionSeconds, syncingBankId, loadData]);

  // Tasa activa según la moneda seleccionada (USD, EUR o P2P)
  const bcvUsdRate = rates.bcvUsd || rates.bcv || 853.50;
  const bcvEurRate = rates.bcvEur || 976.55;
  const binanceP2pRate = rates.binanceP2p || bcvUsdRate;

  const activeRate =
    foreignCurrency === 'USD'
      ? bcvUsdRate
      : foreignCurrency === 'EUR'
      ? bcvEurRate
      : binanceP2pRate;

  // Calcular totales consolidados dinámicos
  let totalBs = 0;
  accounts.forEach((acc) => {
    if (acc.nativeCurrency === 'VES') {
      totalBs += acc.balanceNative;
    } else if (acc.nativeCurrency === 'USD') {
      totalBs += convertValue(acc.balanceNative, 'USD', 'VES', activeRate);
    } else if (acc.nativeCurrency === 'EUR') {
      totalBs += convertValue(acc.balanceNative, 'EUR', 'VES', activeRate);
    }
  });

  const totalForeign = activeRate > 0 ? totalBs / activeRate : 0;

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

    // 2. Si son bancos tradicionales venezolanos con MacroDroid SMS (30s)
    if (protectionSeconds > 0) return;

    setSyncingBankId(bankId);
    setProtectionSeconds(30);

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
  const handleSaveBankBalance = async (bankName: string, monto: number, bankId: string) => {
    try {
      // Actualizar optimistamente el estado visual
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === bankId
            ? { ...a, balanceNative: monto, lastSync: new Date().toISOString() }
            : a
        )
      );

      // Enviar al backend / webhook
      const res = await updateBankBalance({
        banco: bankName,
        monto,
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-slate-950 px-4 py-6 sm:py-10">
      <div className="max-w-2xl mx-auto space-y-6">
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
          hideBalances={hideBalances}
          onToggleHideBalances={handleToggleHideBalances}
        />

        {/* Botón / Banner de instalación PWA para iOS y Android */}
        <PWAInstallButton />

        {/* Lista compacta y limpia de bancos */}
        <div className="space-y-2.5 pb-4">
          <div className="px-1 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Saldos Bancarios
            </h2>
            {isSyncing && (
              <span className="text-[10px] text-emerald-400 font-mono animate-pulse">
                Sincronizando...
              </span>
            )}
          </div>

          <div className="space-y-2">
            {accounts.map((acc) => {
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
                  hideBalances={hideBalances}
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
            })}
          </div>
        </div>
      </div>

      {/* Ventana Modal para editar saldo y disparar webhook a Google Apps Script */}
      <EditBankBalanceModal
        isOpen={editingAccount !== null}
        account={editingAccount}
        onClose={() => setEditingAccount(null)}
        onSave={handleSaveBankBalance}
      />

      {/* Indicador de estado Offline */}
      <OfflineIndicator />
    </div>
  );
}
