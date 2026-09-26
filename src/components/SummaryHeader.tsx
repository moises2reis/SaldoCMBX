import React from 'react';
import { ForeignCurrency } from '../types/dashboard';
import { formatBs, formatUSD, formatRate, formatShortDate } from '../utils/formatters';
import { Eye, EyeOff, RotateCw } from 'lucide-react';

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
  onRefresh?: () => void;
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
  isSyncing = false,
  hideBalances = false,
  onToggleHideBalances,
  onRefresh,
  categoryLabel,
}) => {
  const handleRefreshClick = () => {
    if (onRefresh) {
      onRefresh();
    } else {
      window.location.reload();
    }
  };

  return (
    <header className="pb-1">
      {/* Tarjeta redondeada contenedora de todo el encabezado */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-5 sm:p-6 shadow-xl shadow-black/25 backdrop-blur-md relative overflow-hidden transition-all duration-200">
        {/* Parte superior: Tasas minimalistas sin fondos ni badges */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pb-4 border-b border-slate-800/60">
          <div className="flex items-center justify-center sm:justify-start gap-4 sm:gap-6 flex-wrap text-xs sm:text-[13px]">
            {/* Tasa USD */}
            <button
              type="button"
              onClick={() => onSelectForeignCurrency('USD')}
              className={`transition-all duration-200 flex items-center gap-1.5 cursor-pointer select-none ${
                foreignCurrency === 'USD'
                  ? 'text-white font-bold opacity-100 scale-[1.02]'
                  : 'text-slate-400/60 hover:text-slate-300 opacity-60 hover:opacity-90 font-medium'
              }`}
              title={`Tasa Dólar BCV: ${formatRate(bcvUsd)}`}
            >
              <span className={foreignCurrency === 'USD' ? 'text-emerald-400 font-extrabold' : 'text-slate-400 font-semibold'}>
                USD
              </span>
              <span className="font-mono tabular-nums tracking-tight">
                {formatRate(bcvUsd)}
              </span>
            </button>

            <span className="text-slate-700 select-none">·</span>

            {/* Tasa EUR */}
            <button
              type="button"
              onClick={() => onSelectForeignCurrency('EUR')}
              className={`transition-all duration-200 flex items-center gap-1.5 cursor-pointer select-none ${
                foreignCurrency === 'EUR'
                  ? 'text-white font-bold opacity-100 scale-[1.02]'
                  : 'text-slate-400/60 hover:text-slate-300 opacity-60 hover:opacity-90 font-medium'
              }`}
              title={`Tasa Euro BCV: ${formatRate(bcvEur)}`}
            >
              <span className={foreignCurrency === 'EUR' ? 'text-emerald-400 font-extrabold' : 'text-slate-400 font-semibold'}>
                EUR
              </span>
              <span className="font-mono tabular-nums tracking-tight">
                {formatRate(bcvEur)}
              </span>
            </button>

            <span className="text-slate-700 select-none">·</span>

            {/* Tasa P2P */}
            <button
              type="button"
              onClick={() => onSelectForeignCurrency('P2P')}
              className={`transition-all duration-200 flex items-center gap-1.5 cursor-pointer select-none ${
                foreignCurrency === 'P2P'
                  ? 'text-white font-bold opacity-100 scale-[1.02]'
                  : 'text-slate-400/60 hover:text-slate-300 opacity-60 hover:opacity-90 font-medium'
              }`}
              title={`Tasa Binance P2P: ${formatRate(binanceP2p)}`}
            >
              <span className={foreignCurrency === 'P2P' ? 'text-emerald-400 font-extrabold' : 'text-slate-400 font-semibold'}>
                P2P
              </span>
              <span className="font-mono tabular-nums tracking-tight">
                {formatRate(binanceP2p)}
              </span>
            </button>
          </div>

          {/* Fecha valor en texto sutil minimalista */}
          {fechaValor && (
            <div className="text-[10px] sm:text-[11px] font-mono text-slate-500 tabular-nums tracking-tight">
              Fecha valor: <span className="text-slate-400 font-medium">{fechaValor}</span>
            </div>
          )}
        </div>

        {/* Sección Principal: Monto General */}
        <div className="pt-4 sm:pt-5">
          {categoryLabel && (
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              {categoryLabel === 'Todos' ? 'Total General' : `Total ${categoryLabel}`}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="text-3xl sm:text-4xl lg:text-[40px] font-black font-mono text-emerald-400 tabular-nums tracking-tight leading-none">
                {hideBalances ? '$ ****' : formatUSD(totalForeign)}
              </div>
            </div>

            {/* Botones de acción: ocultar y refrescar */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleHideBalances}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 active:scale-95 rounded-xl transition-all border border-transparent hover:border-slate-700/60"
                title={hideBalances ? 'Mostrar fondos' : 'Ocultar fondos'}
                aria-label={hideBalances ? 'Mostrar fondos' : 'Ocultar fondos'}
              >
                {hideBalances ? (
                  <Eye className="w-5 h-5" />
                ) : (
                  <EyeOff className="w-5 h-5" />
                )}
              </button>
              <button
                type="button"
                onClick={handleRefreshClick}
                disabled={isSyncing}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 active:scale-95 rounded-xl transition-all border border-transparent hover:border-slate-700/60 disabled:opacity-50"
                title="Actualizar datos"
                aria-label="Actualizar datos"
              >
                <RotateCw className={`w-5 h-5 ${isSyncing ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
              </button>
            </div>
          </div>

          {/* Monto en Bolívares */}
          <div className="text-base sm:text-lg font-medium font-mono text-slate-400 tabular-nums tracking-tight mt-1.5">
            {hideBalances ? 'Bs. ****' : formatBs(totalBs)}
          </div>
        </div>
      </div>
    </header>
  );
};
