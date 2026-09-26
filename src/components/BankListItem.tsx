import React, { useState, useEffect } from 'react';
import { BankAccount } from '../types/dashboard';
import { formatBs, formatUSD, convertValue, formatSmartUpdateTime, isOlderThanOneHourAndHalf } from '../utils/formatters';
import { Landmark, RefreshCw, Check, Clock, Gem, Banknote } from 'lucide-react';

interface BankListItemProps {
  account: BankAccount;
  activeRate: number;
  bcvUsdRate?: number;
  bcvEurRate?: number;
  hideBalances?: boolean;
  isSyncing?: boolean;
  isBlocked?: boolean;
  isLoadingInitial?: boolean;
  protectionSeconds?: number;
  justUpdated?: boolean;
  delta?: { diff: number; key: number } | null;
  onSync?: (bankId: string) => void;
  onEditBalance?: (account: BankAccount) => void;
}

export const BankListItem: React.FC<BankListItemProps> = ({
  account,
  activeRate,
  hideBalances = false,
  isSyncing = false,
  isBlocked = false,
  isLoadingInitial = false,
  protectionSeconds = 0,
  justUpdated = false,
  delta = null,
  onEditBalance,
}) => {
  const [, setTick] = useState(0);

  // Recalcular el tiempo transcurrido cada 15 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const isEfectivo = account.categoria?.trim().toLowerCase() === 'efectivo';
  const isBinance =
    account.id === 'binance' ||
    account.bankName.toLowerCase().includes('binance') ||
    account.bankShort.toLowerCase().includes('binance');

  // Montos individuales para efectivo
  const cashUsd = account.montoUsd || 0;
  const cashBs = account.balanceNative || 0;

  // 1. Calcular equivalente dinámico en Bolívares y Dólares
  let amountBs = account.balanceNative;
  let amountUsd = 0;

  if (isEfectivo) {
    // Para efectivo: total en $ es la suma de los dólares en efectivo + los bolívares convertidos a $
    amountUsd = cashUsd + (activeRate > 0 ? cashBs / activeRate : 0);
    amountBs = cashBs + (cashUsd * activeRate);
  } else if (account.nativeCurrency === 'USD') {
    amountBs = convertValue(account.balanceNative, 'USD', 'VES', activeRate);
    amountUsd = account.balanceNative;
  } else if (account.nativeCurrency === 'EUR') {
    amountBs = convertValue(account.balanceNative, 'EUR', 'VES', activeRate);
    amountUsd = activeRate > 0 ? amountBs / activeRate : 0;
  } else {
    amountUsd = activeRate > 0 ? amountBs / activeRate : 0;
  }

  // Subtítulo: para Binance mostrar específicamente 1272204580, para efectivo mostrar indicador
  const displaySubtitle = isBinance
    ? '1272204580'
    : account.accountNumber || (isEfectivo ? 'Efectivo / Caja' : '');

  const timeAgoText = formatSmartUpdateTime(account.lastSync);
  const isOutdated = isOlderThanOneHourAndHalf(account.lastSync);
  
  const isZero = isEfectivo
    ? !hideBalances && Math.abs(cashUsd) < 0.001 && Math.abs(cashBs) < 0.001
    : !hideBalances && Math.abs(amountUsd) < 0.001 && Math.abs(amountBs) < 0.001;

  const renderDeltaBadge = () => {
    if (!delta || hideBalances) return null;
    const isPositive = delta.diff > 0;
    const formattedDiff = `${isPositive ? '+' : '-'}${formatUSD(Math.abs(delta.diff))}`;

    return (
      <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 z-30 pointer-events-none whitespace-nowrap">
        <span
          key={delta.key}
          className={`inline-flex items-center text-[10px] sm:text-xs font-mono font-extrabold px-1.5 py-0.5 rounded-lg shadow-lg border backdrop-blur-md animate-in fade-in zoom-in-95 slide-in-from-right-2 duration-200 select-none ${
            isPositive
              ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400/60 shadow-emerald-950/80 ring-1 ring-emerald-400/40'
              : 'bg-rose-500/30 text-rose-300 border-rose-400/60 shadow-rose-950/80 ring-1 ring-rose-400/40'
          }`}
        >
          {formattedDiff}
        </span>
      </div>
    );
  };

  const handleCardClick = () => {
    if (onEditBalance) {
      onEditBalance(account);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      title="Toca para actualizar (Macro o Manual)"
      className={`relative overflow-hidden rounded-2xl px-3.5 py-3 sm:px-4 sm:py-3.5 transition-all duration-300 flex items-center justify-between gap-3 shadow-sm select-none group cursor-pointer ${
        isSyncing
          ? 'bg-slate-900 border-amber-500/60 ring-1 ring-amber-500/50 shadow-lg shadow-amber-500/10'
          : justUpdated
          ? 'bg-slate-900 border-emerald-500/70 ring-1 ring-emerald-500/50 shadow-lg shadow-emerald-500/15'
          : 'bg-slate-900/80 hover:bg-slate-900 active:bg-slate-800/90 active:scale-[0.985] active:brightness-95 border border-slate-800/80 hover:border-slate-700'
      }`}
    >
      {/* Barra animada de escaneo superior cuando la macro está actualizando */}
      {isSyncing && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-pulse" />
      )}
      {justUpdated && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
      )}

      {/* Izquierda: Icono y nombre */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 transition-colors ${
            isSyncing
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
              : justUpdated
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
              : 'bg-slate-800/80 border-slate-700/50 group-hover:border-slate-600'
          }`}
        >
          {isSyncing ? (
            <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
          ) : justUpdated ? (
            <Check className="w-4 h-4 text-emerald-400 animate-bounce" />
          ) : isBinance ? (
            <Gem className="w-4 h-4 text-slate-400" />
          ) : isEfectivo ? (
            <Banknote className="w-4 h-4 text-slate-400" />
          ) : (
            <Landmark className="w-4 h-4 text-slate-400" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`font-bold text-sm tracking-tight truncate transition-colors ${
                isSyncing
                  ? 'text-amber-200'
                  : justUpdated
                  ? 'text-emerald-300'
                  : 'text-white group-hover:text-emerald-300'
              }`}
            >
              {account.bankShort}
            </span>
          </div>

          {isSyncing ? (
            <div className="text-[11px] text-amber-300 font-mono truncate mt-0.5 animate-pulse">
              Actualizando con macro {protectionSeconds > 0 ? `(${protectionSeconds}s)` : '...'}
            </div>
          ) : displaySubtitle ? (
            <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
              {displaySubtitle}
            </div>
          ) : null}
        </div>
      </div>

      {/* Derecha: Montos y tiempo transcurrido */}
      <div className="text-right flex flex-col items-end shrink-0">
        {isLoadingInitial && isZero ? (
          <div className="space-y-1.5 flex flex-col items-end">
            <div className="h-4 w-16 bg-slate-800 animate-pulse rounded-md" />
            <div className="h-3 w-12 bg-slate-800/60 animate-pulse rounded-md" />
          </div>
        ) : isZero ? (
          /* Monto en 0: un solo '-' en gris */
          <div className="text-sm sm:text-base font-bold font-mono text-slate-500 tabular-nums leading-tight">
            -
          </div>
        ) : isEfectivo ? (
          <>
            {/* Tarjeta Efectivo: Total en $ en VERDE con superposición flotante a la izquierda */}
            <div className="relative inline-flex items-center justify-end">
              {renderDeltaBadge()}
              <div className="text-sm sm:text-base font-bold font-mono text-emerald-400 tabular-nums leading-tight">
                {hideBalances ? '$ ****' : formatUSD(amountUsd)}
              </div>
            </div>

            {/* Tarjeta Efectivo: Debajo en GRIS y más pequeño los montos en $ y Bs individuales */}
            <div className="text-[10px] sm:text-[11px] font-medium font-mono text-slate-400 tabular-nums leading-tight mt-0.5 flex items-center justify-end gap-1.5">
              {hideBalances ? (
                <span>$ **** · Bs. ****</span>
              ) : (
                <>
                  <span>{formatUSD(cashUsd)}</span>
                  <span className="text-slate-600">·</span>
                  <span>{formatBs(cashBs)}</span>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Monto en Dólares con superposición flotante a la izquierda */}
            <div className="relative inline-flex items-center justify-end">
              {renderDeltaBadge()}
              <div className="text-sm sm:text-base font-bold font-mono text-emerald-400 tabular-nums leading-tight">
                {hideBalances ? '$ ****' : formatUSD(amountUsd)}
              </div>
            </div>

            {/* Monto en Bolívares (Original: siempre Gris) */}
            <div className="text-[11px] sm:text-xs font-medium font-mono text-slate-400 tabular-nums leading-tight mt-0.5">
              {hideBalances ? 'Bs. ****' : formatBs(amountBs)}
            </div>
          </>
        )}

        {/* Tiempo transcurrido debajo del monto (solo si existe fecha y no está sincronizando) */}
        {!isSyncing && timeAgoText ? (
          <div
            className={`inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-mono tabular-nums mt-0.5 ${
              isOutdated ? 'text-amber-400 font-medium' : 'text-slate-500'
            }`}
          >
            <Clock className={`w-2.5 h-2.5 ${isOutdated ? 'text-amber-400' : 'text-slate-500'}`} />
            <span>{timeAgoText}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

