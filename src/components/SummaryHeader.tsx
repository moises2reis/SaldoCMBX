import React from 'react';
import { ForeignCurrency } from '../types/dashboard';
import { formatBs, formatUSD, formatRate, formatShortDate } from '../utils/formatters';
import { Eye, EyeOff } from 'lucide-react';

interface SummaryHeaderProps {
  totalBs: number;
  totalForeign: number;
  foreignCurrency: ForeignCurrency;
  onSelectForeignCurrency: (curr: ForeignCurrency) => void;
  bcvUsd: number;
  bcvEur: number;
  binanceP2p?: number;
  fechaValor?: string;
  isSyncing?: boolean;
  hideBalances?: boolean;
  onToggleHideBalances?: () => void;
  categoryLabel?: string;
}

export const SummaryHeader: React.FC<SummaryHeaderProps> = ({
  totalBs,
  totalForeign,
  foreignCurrency,
  onSelectForeignCurrency,
  bcvUsd,
  bcvEur,
  binanceP2p = 0,
  fechaValor,
  hideBalances = false,
  onToggleHideBalances,
  categoryLabel,
}) => {
  const shortDate = formatShortDate(fechaValor);

  return (
    <header className="space-y-3 pb-1">
      {/* Barra superior: Título ComboxBanks + Fecha resumida simple a la derecha sin badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            ComboxBanks
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </h1>
          {shortDate && (
            <span className="text-xs sm:text-sm text-slate-400 font-mono tracking-tight font-normal">
              {shortDate}
            </span>
          )}
        </div>
      </div>

      {/* Botones de las tasas: Más pequeños, alineados y centrados en el medio */}
      <div className="flex justify-center w-full pt-0.5 pb-1">
        <div className="inline-flex p-0.5 bg-slate-900 border border-slate-800 rounded-xl shadow-inner text-[11px]">
          {/* Toggle Dólar USD */}
          <button
            type="button"
            onClick={() => onSelectForeignCurrency('USD')}
            className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition-all flex items-center gap-1.5 ${
              foreignCurrency === 'USD'
                ? 'bg-slate-950 text-white shadow-sm font-semibold border border-slate-700/50'
                : 'text-slate-400 hover:text-slate-200 bg-transparent border border-transparent'
            }`}
            title={`Tasa Dólar BCV: ${formatRate(bcvUsd)}`}
          >
            <span className={foreignCurrency === 'USD' ? 'text-white font-bold' : 'text-slate-400'}>
              USD
            </span>
            <span className="font-semibold tabular-nums">
              {formatRate(bcvUsd)}
            </span>
          </button>

          {/* Toggle Euro EUR */}
          <button
            type="button"
            onClick={() => onSelectForeignCurrency('EUR')}
            className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition-all flex items-center gap-1.5 ${
              foreignCurrency === 'EUR'
                ? 'bg-slate-950 text-white shadow-sm font-semibold border border-slate-700/50'
                : 'text-slate-400 hover:text-slate-200 bg-transparent border border-transparent'
            }`}
            title={`Tasa Euro BCV: ${formatRate(bcvEur)}`}
          >
            <span className={foreignCurrency === 'EUR' ? 'text-white font-bold' : 'text-slate-400'}>
              EUR
            </span>
            <span className="font-semibold tabular-nums">
              {formatRate(bcvEur)}
            </span>
          </button>

          {/* Toggle Binance P2P */}
          <button
            type="button"
            onClick={() => onSelectForeignCurrency('P2P')}
            className={`px-2.5 py-1 rounded-lg font-mono text-[11px] transition-all flex items-center gap-1.5 ${
              foreignCurrency === 'P2P'
                ? 'bg-slate-950 text-white shadow-sm font-semibold border border-slate-700/50'
                : 'text-slate-400 hover:text-slate-200 bg-transparent border border-transparent'
            }`}
            title={`Tasa Binance P2P: ${formatRate(binanceP2p)}`}
          >
            <span className={foreignCurrency === 'P2P' ? 'text-white font-bold' : 'text-slate-400'}>
              P2P
            </span>
            <span className="font-semibold tabular-nums">
              {formatRate(binanceP2p)}
            </span>
          </button>
        </div>
      </div>

      {/* Resumen Total: Espacio intermedio más amplio arriba del total del saldo */}
      <div className="pt-3 sm:pt-4">
        {categoryLabel && (
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
            {categoryLabel === 'Todos' ? 'Total General' : `Total ${categoryLabel}`}
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-400 tabular-nums tracking-tight">
            {hideBalances ? '$ ****' : formatUSD(totalForeign)}
          </div>
          <button
            type="button"
            onClick={onToggleHideBalances}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 rounded-lg transition-colors border border-transparent hover:border-slate-800"
            title={hideBalances ? 'Mostrar fondos' : 'Ocultar fondos'}
            aria-label={hideBalances ? 'Mostrar fondos' : 'Ocultar fondos'}
          >
            {hideBalances ? (
              <Eye className="w-5 h-5" />
            ) : (
              <EyeOff className="w-5 h-5" />
            )}
          </button>
        </div>
        <div className="text-base sm:text-lg font-medium font-mono text-slate-400 tabular-nums tracking-tight mt-0.5">
          {hideBalances ? 'Bs. ****' : formatBs(totalBs)}
        </div>
      </div>
    </header>
  );
};
