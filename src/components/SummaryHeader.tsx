import React from 'react';
import { ForeignCurrency } from '../types/dashboard';
import { formatBs, formatUSD, formatRate } from '../utils/formatters';
import { Eye, EyeOff, Terminal } from 'lucide-react';

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
  onOpenSupabaseModal?: () => void;
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
  onOpenSupabaseModal,
}) => {
  return (
    <header className="space-y-4 pb-5 border-b border-slate-800/80">
      {/* Barra superior: Título a la izquierda, Toggle con Fecha debajo a la derecha */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Izquierda: Título limpio */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              ComboxBanks
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </h1>
          </div>
        </div>

        {/* Derecha: Toggle Dólar / Euro / P2P (con fecha centrada debajo) */}
        <div className="flex items-start gap-2 self-start sm:self-auto">
          {/* Columna del Toggle y la Fecha centrada en el medio del toggle */}
          <div className="flex flex-col items-center gap-1">
            {/* Segmented Toggle USD / EUR / P2P */}
            <div className="inline-flex p-1 bg-slate-900 border border-slate-800 rounded-2xl shadow-inner">
              {/* Toggle Dólar USD */}
              <button
                type="button"
                onClick={() => onSelectForeignCurrency('USD')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                  foreignCurrency === 'USD'
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 bg-transparent'
                }`}
                title={`Tasa Dólar BCV: ${formatRate(bcvUsd)}`}
              >
                <span className={foreignCurrency === 'USD' ? 'text-white font-bold' : 'text-slate-400'}>
                  USD $
                </span>
                <span className="font-bold tabular-nums">
                  {formatRate(bcvUsd)}
                </span>
              </button>

              {/* Toggle Euro EUR */}
              <button
                type="button"
                onClick={() => onSelectForeignCurrency('EUR')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                  foreignCurrency === 'EUR'
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 bg-transparent'
                }`}
                title={`Tasa Euro BCV: ${formatRate(bcvEur)}`}
              >
                <span className={foreignCurrency === 'EUR' ? 'text-white font-bold' : 'text-slate-400'}>
                  EUR €
                </span>
                <span className="font-bold tabular-nums">
                  {formatRate(bcvEur)}
                </span>
              </button>

              {/* Toggle Binance P2P */}
              <button
                type="button"
                onClick={() => onSelectForeignCurrency('P2P')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5 ${
                  foreignCurrency === 'P2P'
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 bg-transparent'
                }`}
                title={`Tasa Binance P2P: ${formatRate(binanceP2p)}`}
              >
                <span className={foreignCurrency === 'P2P' ? 'text-white font-bold' : 'text-slate-400'}>
                  P2P $
                </span>
                <span className="font-bold tabular-nums">
                  {formatRate(binanceP2p)}
                </span>
              </button>
            </div>

            {/* Fecha sutil centrada exactamente en el medio de los botones de la tasa */}
            {fechaValor && (
              <div className="text-[11px] text-slate-400/90 font-mono tracking-tight text-center">
                {fechaValor}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resumen Total: Total en Dólares ($) con botón de ojo para ocultar/mostrar fondos */}
      <div className="pt-1">
        <div className="flex items-center gap-2.5">
          <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-400 tabular-nums tracking-tight">
            {hideBalances ? '$ ****' : formatUSD(totalForeign)}
          </div>
          <div className="flex items-center gap-1.5">
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
            {onOpenSupabaseModal && (
              <button
                type="button"
                onClick={onOpenSupabaseModal}
                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-900/80 rounded-lg transition-colors border border-transparent hover:border-slate-800"
                title="Consola de Diagnóstico & Logs Supabase/Binance"
                aria-label="Consola de Diagnóstico & Logs Supabase/Binance"
              >
                <Terminal className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="text-base sm:text-lg font-medium font-mono text-slate-400 tabular-nums tracking-tight mt-0.5">
          {hideBalances ? 'Bs. ****' : formatBs(totalBs)}
        </div>
      </div>
    </header>
  );
};
