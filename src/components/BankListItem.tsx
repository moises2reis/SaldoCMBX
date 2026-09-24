import React, { useState, useEffect } from 'react';
import { BankAccount } from '../types/dashboard';
import { formatBs, formatUSD, convertValue, formatSmartUpdateTime } from '../utils/formatters';
import { Landmark, RefreshCw, Check, Clock, Gem } from 'lucide-react';

interface BankListItemProps {
  account: BankAccount;
  activeRate: number;
  bcvUsdRate?: number;
  bcvEurRate?: number;
  hideBalances?: boolean;
  isSyncing?: boolean;
  isBlocked?: boolean;
  protectionSeconds?: number;
  justUpdated?: boolean;
  onSync?: (bankId: string) => void;
  onEditBalance?: (account: BankAccount) => void;
}

export const BankListItem: React.FC<BankListItemProps> = ({
  account,
  activeRate,
  hideBalances = false,
  isSyncing = false,
  isBlocked = false,
  protectionSeconds = 0,
  justUpdated = false,
  onSync,
  onEditBalance,
}) => {
  const [, setTick] = useState(0);

  // Recalcular los minutos transcurridos cada 15 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setTick((t) => t + 1);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // 1. Calcular equivalente dinámico en Bolívares según la tasa seleccionada
  let amountBs = account.balanceNative;
  if (account.nativeCurrency === 'USD') {
    amountBs = convertValue(account.balanceNative, 'USD', 'VES', activeRate);
  } else if (account.nativeCurrency === 'EUR') {
    amountBs = convertValue(account.balanceNative, 'EUR', 'VES', activeRate);
  }

  // 2. Calcular monto en dólares/divisa usando la tasa activa seleccionada
  const amountUsd =
    account.nativeCurrency === 'USD'
      ? account.balanceNative
      : activeRate > 0
      ? amountBs / activeRate
      : 0;

  const isBinance =
    account.id === 'binance' ||
    account.bankName.toLowerCase().includes('binance') ||
    account.bankShort.toLowerCase().includes('binance');

  // Subtítulo: para Binance mostrar específicamente 1272204580
  const displaySubtitle = isBinance ? '1272204580' : account.accountNumber;
  const timeAgoText = formatSmartUpdateTime(account.lastSync);
  const isZero = !hideBalances && Math.abs(amountUsd) < 0.001 && Math.abs(amountBs) < 0.001;

  const handleRefreshClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSyncing || isBlocked) return;
    if (onSync) {
      onSync(account.id);
    }
  };

  const handleCardClick = () => {
    if (isBinance) {
      if (onSync && !isSyncing && !isBlocked) {
        onSync(account.id);
      }
      return;
    }
    if (onEditBalance) {
      onEditBalance(account);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      title={isBinance ? "Toca para sincronizar Binance" : "Toca para editar saldo y enviar webhook"}
      className={`bg-slate-900/80 hover:bg-slate-900 active:bg-slate-800/80 border border-slate-800/80 hover:border-slate-700 rounded-2xl px-3.5 py-3 sm:px-4 sm:py-3.5 transition-all flex items-center justify-between gap-3 shadow-sm select-none group ${
        isBinance ? 'cursor-default' : 'cursor-pointer'
      }`}
    >
      {/* Izquierda: Icono y nombre */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 bg-slate-800/80 border-slate-700/50">
          {isBinance ? (
            <Gem className="w-4 h-4 text-slate-400" />
          ) : (
            <Landmark className="w-4 h-4 text-slate-400" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white tracking-tight truncate">
              {account.bankShort}
            </span>
          </div>
          {displaySubtitle && (
            <div className="text-[11px] text-slate-400 font-mono truncate mt-0.5">
              {displaySubtitle}
            </div>
          )}
        </div>
      </div>

      {/* Derecha: Montos, tiempo transcurrido y Botón individual de actualización */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Montos y tiempo transcurrido */}
        <div className="text-right flex flex-col items-end">
          {isZero ? (
            /* Monto en 0: un solo '-' en gris */
            <div className="text-sm sm:text-base font-bold font-mono text-slate-500 tabular-nums leading-tight">
              -
            </div>
          ) : (
            <>
              {/* Monto en Dólares (Original: siempre Verde) */}
              <div className="text-sm sm:text-base font-bold font-mono text-emerald-400 tabular-nums leading-tight">
                {hideBalances ? '$ ****' : formatUSD(amountUsd)}
              </div>

              {/* Monto en Bolívares (Original: siempre Gris) */}
              <div className="text-[11px] sm:text-xs font-medium font-mono text-slate-400 tabular-nums leading-tight mt-0.5">
                {hideBalances ? 'Bs. ****' : formatBs(amountBs)}
              </div>
            </>
          )}

          {/* Tiempo transcurrido debajo del monto (solo si existe fecha) */}
          {timeAgoText ? (
            <div className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-slate-500 tabular-nums mt-0.5">
              <Clock className="w-2.5 h-2.5 text-slate-500" />
              <span>{timeAgoText}</span>
            </div>
          ) : null}
        </div>

        {/* Botón individual de actualizar con protección */}
        <button
          type="button"
          onClick={handleRefreshClick}
          disabled={isSyncing || isBlocked}
          title={
            isSyncing
              ? `Actualizando ${account.bankShort}... Protección activa (${protectionSeconds}s)`
              : isBlocked
              ? `Protección activa: espera ${protectionSeconds}s para actualizar otros bancos`
              : `Actualizar ${account.bankShort}`
          }
          aria-label={`Actualizar ${account.bankShort}`}
          className={`min-w-9 h-9 px-2.5 rounded-xl border transition-all flex items-center justify-center gap-1 shrink-0 ${
            justUpdated
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
              : isSyncing
              ? 'bg-slate-800 border-amber-500/40 text-amber-400 cursor-wait'
              : isBlocked
              ? 'bg-slate-900/40 border-slate-800/60 text-slate-600 opacity-40 cursor-not-allowed'
              : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 hover:border-slate-600 text-slate-400 hover:text-white active:scale-95'
          }`}
        >
          {justUpdated ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : isSyncing ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span className="text-[10px] font-mono font-bold text-amber-400">{protectionSeconds}s</span>
            </>
          ) : isBlocked ? (
            <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
};

