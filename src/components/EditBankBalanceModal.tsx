import React, { useState, useEffect } from 'react';
import { BankAccount } from '../types/dashboard';
import {
  formatSmartUpdateTime,
  isOlderThanOneHourAndHalf,
  formatFullDateTime,
} from '../utils/formatters';
import {
  X,
  Check,
  Landmark,
  Gem,
  Banknote,
  Loader2,
  Zap,
  Edit3,
  Clock,
  ArrowDownUp,
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface EditBankBalanceModalProps {
  isOpen: boolean;
  account: BankAccount | null;
  onClose: () => void;
  onSave: (bankName: string, monto: number, bankId: string, montoUsd?: number) => Promise<void>;
  onSyncMacro?: (bankId: string) => Promise<void> | void;
  isSyncingMacro?: boolean;
  protectionSeconds?: number;
  isBlocked?: boolean;
}

// Formateador con puntos de miles y coma decimal
const formatSpanishNumber = (num: number): string => {
  if (num === 0) return '0';
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(num);
};

const parseSpanishNumber = (str: string): number => {
  if (!str) return 0;
  const clean = str.replace(/\./g, '').replace(/,/g, '.').trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

// Formateo dinámico al escribir
const formatInputValue = (inputVal: string): string => {
  if (!inputVal) return '';
  if (/[^\d.,]/.test(inputVal)) return inputVal;

  const endsWithSeparator = inputVal.endsWith(',') || inputVal.endsWith('.');

  if (inputVal.includes(',')) {
    const [intPart, ...decParts] = inputVal.split(',');
    const cleanInt = intPart.replace(/\D/g, '');
    const cleanDec = decParts.join('').replace(/\D/g, '').slice(0, 4);
    const formattedInt = cleanInt ? new Intl.NumberFormat('de-DE').format(BigInt(cleanInt)) : '';
    if (endsWithSeparator && cleanDec === '') {
      return `${formattedInt || '0'},`;
    }
    return cleanDec !== '' ? `${formattedInt || '0'},${cleanDec}` : formattedInt;
  } else if (inputVal.includes('.')) {
    if (endsWithSeparator) {
      const cleanInt = inputVal.slice(0, -1).replace(/\D/g, '');
      const formattedInt = cleanInt ? new Intl.NumberFormat('de-DE').format(BigInt(cleanInt)) : '';
      return `${formattedInt || '0'},`;
    } else {
      const cleanInt = inputVal.replace(/\D/g, '');
      return cleanInt ? new Intl.NumberFormat('de-DE').format(BigInt(cleanInt)) : '';
    }
  } else {
    const cleanInt = inputVal.replace(/\D/g, '');
    return cleanInt ? new Intl.NumberFormat('de-DE').format(BigInt(cleanInt)) : '';
  }
};

export const EditBankBalanceModal: React.FC<EditBankBalanceModalProps> = ({
  isOpen,
  account,
  onClose,
  onSave,
  onSyncMacro,
  isSyncingMacro = false,
  protectionSeconds = 0,
  isBlocked = false,
}) => {
  const [balanceInput, setBalanceInput] = useState<string>('');
  const [montoBsInput, setMontoBsInput] = useState<string>('');
  const [montoUsdInput, setMontoUsdInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'macro' | 'manual' | 'delta'>('macro');
  const [macroTriggered, setMacroTriggered] = useState<boolean>(false);

  // Estados para la pestaña Ingreso / Egreso
  const [movementType, setMovementType] = useState<'ingreso' | 'egreso'>('ingreso');
  const [movementAmount, setMovementAmount] = useState<string>(''); // Para cuentas regulares
  const [movementAmountUsd, setMovementAmountUsd] = useState<string>(''); // Para Efectivo Dólares
  const [movementAmountBs, setMovementAmountBs] = useState<string>(''); // Para Efectivo Bolívares

  useEffect(() => {
    if (account) {
      const isEf = account.categoria?.trim().toLowerCase() === 'efectivo';
      if (isEf) {
        setMontoBsInput(formatSpanishNumber(account.balanceNative));
        setMontoUsdInput(formatSpanishNumber(account.montoUsd || 0));
        setActiveTab('delta'); // Efectivo por defecto en Ingreso/Egreso
      } else {
        setBalanceInput(formatSpanishNumber(account.balanceNative));
        setActiveTab('macro'); // Bancos por defecto en macro
      }
      setMovementAmount('');
      setMovementAmountUsd('');
      setMovementAmountBs('');
      setMovementType('ingreso');
      setMacroTriggered(false);
    }
  }, [account, isOpen]);

  // Permitir cerrar inmediatamente con la tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !account) return null;

  const isEfectivo = account.categoria?.trim().toLowerCase() === 'efectivo';
  const isBinance =
    account.id === 'binance' ||
    account.bankName.toLowerCase().includes('binance') ||
    account.bankShort.toLowerCase().includes('binance');

  const timeAgoText = formatSmartUpdateTime(account.lastSync);
  const fullDateTimeText = formatFullDateTime(account.lastSync);
  const isOutdated = isOlderThanOneHourAndHalf(account.lastSync);

  const currencyUnit = isBinance ? 'USDT' : account.nativeCurrency === 'USD' ? 'USD' : 'Bs.';

  const handleGenericChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const val = e.target.value;
    if (val && /[^\d.,]/.test(val)) return;
    setter(formatInputValue(val));
  };

  const handleMacroSync = () => {
    if (isBlocked || isSyncingMacro) return;
    setMacroTriggered(true);
    if (onSyncMacro) {
      // Disparar sincronización en segundo plano sin retener la ventana
      Promise.resolve(onSyncMacro(account.id)).catch((err) => {
        console.warn('Error en sincronización en segundo plano:', err);
      });
    }
    // Cerrar inmediatamente la ventana modal para permitir interactuar con la app
    onClose();
  };

  // Guardar cambio de saldo manual directo
  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const bankNameToSend = account.bankShort || account.bankId || account.bankName;

      if (isEfectivo) {
        const numBs = parseSpanishNumber(montoBsInput);
        const numUsd = parseSpanishNumber(montoUsdInput);
        await onSave(bankNameToSend, numBs, account.id, numUsd);
      } else {
        const num = parseSpanishNumber(balanceInput);
        if (num < 0) return;
        await onSave(bankNameToSend, num, account.id);
      }

      onClose();
    } catch (err) {
      console.error('Error saving bank balance:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guardar cálculo de Ingreso / Egreso sumando o restando al monto del servidor
  const handleSubmitDelta = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const bankNameToSend = account.bankShort || account.bankId || account.bankName;

      if (isEfectivo) {
        const deltaUsd = parseSpanishNumber(movementAmountUsd);
        const deltaBs = parseSpanishNumber(movementAmountBs);

        if (deltaUsd <= 0 && deltaBs <= 0) {
          setIsSubmitting(false);
          return;
        }

        const currentBs = account.balanceNative || 0;
        const currentUsd = account.montoUsd || 0;

        let finalUsd = currentUsd;
        let finalBs = currentBs;

        if (deltaUsd > 0) {
          finalUsd =
            movementType === 'ingreso' ? currentUsd + deltaUsd : Math.max(0, currentUsd - deltaUsd);
        }

        if (deltaBs > 0) {
          finalBs =
            movementType === 'ingreso' ? currentBs + deltaBs : Math.max(0, currentBs - deltaBs);
        }

        await onSave(bankNameToSend, finalBs, account.id, finalUsd);
      } else {
        const delta = parseSpanishNumber(movementAmount);
        if (delta <= 0) {
          setIsSubmitting(false);
          return;
        }

        const currentBalance = account.balanceNative || 0;
        const finalBalance =
          movementType === 'ingreso'
            ? currentBalance + delta
            : Math.max(0, currentBalance - delta);

        await onSave(bankNameToSend, finalBalance, account.id);
      }

      onClose();
    } catch (err) {
      console.error('Error applying ingreso/egreso movement:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cálculos en vivo para la vista previa de Ingreso / Egreso
  const deltaUsdNum = parseSpanishNumber(movementAmountUsd);
  const deltaBsNum = parseSpanishNumber(movementAmountBs);
  const currentUsdNum = account.montoUsd || 0;
  const currentBsNum = account.balanceNative || 0;

  const finalUsdPreview =
    movementType === 'ingreso' ? currentUsdNum + deltaUsdNum : Math.max(0, currentUsdNum - deltaUsdNum);
  const finalBsPreview =
    movementType === 'ingreso' ? currentBsNum + deltaBsNum : Math.max(0, currentBsNum - deltaBsNum);

  // Para cuentas regulares (no efectivo)
  const deltaRegularNum = parseSpanishNumber(movementAmount);
  const currentRegularNum = account.balanceNative || 0;
  const finalRegularPreview =
    movementType === 'ingreso'
      ? currentRegularNum + deltaRegularNum
      : Math.max(0, currentRegularNum - deltaRegularNum);

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Encabezado con Icono del Banco/Efectivo y Botón Cerrar */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center border bg-slate-800/80 border-slate-700/50">
              {isBinance ? (
                <Gem className="w-5 h-5 text-slate-300" />
              ) : isEfectivo ? (
                <Banknote className="w-5 h-5 text-slate-300" />
              ) : (
                <Landmark className="w-5 h-5 text-slate-300" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {account.bankShort}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {isBinance
                  ? '1272204580'
                  : account.accountNumber || (isEfectivo ? 'Efectivo / Caja' : account.bankName)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Pestañas: Con Macro vs Manual vs Ingreso/Egreso */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 border border-slate-800 rounded-2xl mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('macro')}
            className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'macro'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            {isBinance ? (
              <Gem className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            ) : (
              <Zap className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate">{isBinance ? 'API Binance' : 'Macro'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'manual'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Manual</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('delta')}
            className={`py-2 px-2 rounded-xl text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'delta'
                ? 'bg-slate-800 text-emerald-400 border border-slate-700 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <ArrowDownUp className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Ingreso/Egreso</span>
          </button>
        </div>

        {/* CONTENIDO PESTAÑA: ACTUALIZAR CON MACRO / API BINANCE */}
        {activeTab === 'macro' && (
          <div className="space-y-4 py-1">
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 text-center space-y-3">
              <div
                className={`w-11 h-11 mx-auto rounded-full flex items-center justify-center border transition-colors ${
                  isBinance
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                    : isOutdated
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                    : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                }`}
              >
                {isBinance ? <Gem className="w-5 h-5 text-amber-400" /> : <Zap className="w-5 h-5" />}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white">
                  {isBinance ? 'Sincronización con API Binance' : 'Actualización Automática'}
                </h4>
                {isBinance && (
                  <p className="text-[11px] text-slate-400 mt-1 font-mono">
                    Consulta en vivo Spot + Funding + Simple Earn Flexible
                  </p>
                )}
              </div>

              {/* Registro completo de Fecha y Hora de la última actualización */}
              <div className="bg-slate-900/90 border border-slate-800/90 rounded-xl p-3 text-left space-y-1.5 shadow-inner">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                  <Clock
                    className={`w-3.5 h-3.5 ${
                      isBinance ? 'text-amber-400' : isOutdated ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  />
                  <span>Última actualización:</span>
                </div>

                <div className="text-xs font-mono font-semibold text-slate-200 tracking-tight pl-5">
                  {fullDateTimeText || 'Sin registro de fecha'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleMacroSync}
              disabled={isSyncingMacro || isBlocked || macroTriggered}
              className={`w-full py-3 px-4 rounded-2xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg select-none ${
                macroTriggered
                  ? 'bg-emerald-600 text-white border border-emerald-500 shadow-emerald-950/60'
                  : isSyncingMacro
                  ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 cursor-wait'
                  : isBlocked
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : isBinance
                  ? 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold border border-amber-400 shadow-amber-950/60'
                  : isOutdated
                  ? 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold border border-amber-400 shadow-amber-950/60'
                  : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold border border-emerald-500/60 shadow-emerald-950/60'
              }`}
            >
              {macroTriggered ? (
                <>
                  <Check className="w-4 h-4 text-white animate-bounce" />
                  <span>
                    {isBinance
                      ? '¡Saldo consultado desde Binance API!'
                      : '¡Macro solicitada con éxito!'}
                  </span>
                </>
              ) : isSyncingMacro ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                  <span>
                    {isBinance
                      ? 'Consultando API de Binance...'
                      : `Sincronizando (${protectionSeconds}s)...`}
                  </span>
                </>
              ) : isBlocked ? (
                <span>Espera {protectionSeconds}s para otra macro</span>
              ) : (
                <>
                  {isBinance ? (
                    <Gem className="w-4 h-4 text-slate-950" />
                  ) : (
                    <Zap className={`w-4 h-4 ${isOutdated ? 'text-slate-950' : 'text-white'}`} />
                  )}
                  <span>
                    {isBinance ? 'Actualizar con API Binance' : 'Actualizar con Macro'}
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {/* CONTENIDO PESTAÑA: ACTUALIZAR MANUAL (SALDO TOTAL ABSOLUTO) */}
        {activeTab === 'manual' && (
          <form onSubmit={handleSubmitManual} className="space-y-4">
            {isEfectivo ? (
              /* 2 Inputs separados para Efectivo: Monto en Bs y Monto en $ */
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Monto en Bolívares (Bs.):
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={montoBsInput}
                      onChange={(e) => handleGenericChange(e, setMontoBsInput)}
                      autoFocus
                      disabled={isSubmitting}
                      placeholder="0,00"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-lg font-mono font-bold text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-600"
                    />
                    <span className="absolute right-3.5 top-3 text-xs font-mono font-semibold text-slate-400">
                      Bs.
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Monto en Dólares ($):
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={montoUsdInput}
                      onChange={(e) => handleGenericChange(e, setMontoUsdInput)}
                      disabled={isSubmitting}
                      placeholder="0,00"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-2.5 text-lg font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-600"
                    />
                    <span className="absolute right-3.5 top-3 text-xs font-mono font-semibold text-emerald-400/80">
                      $ USD
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* 1 Input para bancos regulares */
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Saldo actual ({currencyUnit}):
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={balanceInput}
                    onChange={(e) => handleGenericChange(e, setBalanceInput)}
                    autoFocus
                    disabled={isSubmitting}
                    placeholder="0,00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-3 text-xl font-mono font-bold text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-600"
                  />
                  <span className="absolute right-3.5 top-3.5 text-xs font-mono font-semibold text-slate-400">
                    {currencyUnit}
                  </span>
                </div>
              </div>
            )}

            {/* Botones de acción manual */}
            <div className="flex gap-2.5 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white rounded-xl border border-slate-800 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  (isEfectivo ? montoBsInput === '' && montoUsdInput === '' : balanceInput === '')
                }
                className="px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-950/50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar Saldo</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* CONTENIDO PESTAÑA: INGRESO / EGRESO (SUMA O RESTA DEL SERVIDOR) */}
        {activeTab === 'delta' && (
          <form onSubmit={handleSubmitDelta} className="space-y-4">
            {/* Toggle Ingreso vs Egreso */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Tipo de movimiento:
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setMovementType('ingreso')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    movementType === 'ingreso'
                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/60 shadow-sm ring-1 ring-emerald-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                  }`}
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>Ingreso (+)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType('egreso')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    movementType === 'egreso'
                      ? 'bg-rose-950/80 text-rose-400 border border-rose-500/60 shadow-sm ring-1 ring-rose-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                  }`}
                >
                  <Minus className="w-4 h-4 text-rose-400" />
                  <span>Egreso (-)</span>
                </button>
              </div>
            </div>

            {isEfectivo ? (
              /* Caso BOLSO / BÓVEDA: 2 inputs simultáneos (Dólares y Bolívares) */
              <div className="space-y-3">
                {/* Input Dólares ($) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">
                      Monto en Dólares ($):
                    </label>
                    <span className="text-[11px] font-mono text-slate-400">
                      Servidor: ${formatSpanishNumber(currentUsdNum)}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={movementAmountUsd}
                      onChange={(e) => handleGenericChange(e, setMovementAmountUsd)}
                      autoFocus
                      disabled={isSubmitting}
                      placeholder="0,00"
                      className={`w-full bg-slate-950 border rounded-2xl px-3.5 py-2.5 text-lg font-mono font-bold focus:outline-none transition-all placeholder:text-slate-600 ${
                        movementType === 'ingreso'
                          ? 'border-slate-800 text-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                          : 'border-slate-800 text-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      }`}
                    />
                    <span
                      className={`absolute right-3.5 top-3 text-xs font-mono font-bold ${
                        movementType === 'ingreso' ? 'text-emerald-400/90' : 'text-rose-400/90'
                      }`}
                    >
                      $ USD
                    </span>
                  </div>
                </div>

                {/* Input Bolívares (Bs.) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-300">
                      Monto en Bolívares (Bs.):
                    </label>
                    <span className="text-[11px] font-mono text-slate-400">
                      Servidor: Bs. {formatSpanishNumber(currentBsNum)}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={movementAmountBs}
                      onChange={(e) => handleGenericChange(e, setMovementAmountBs)}
                      disabled={isSubmitting}
                      placeholder="0,00"
                      className={`w-full bg-slate-950 border rounded-2xl px-3.5 py-2.5 text-lg font-mono font-bold focus:outline-none transition-all placeholder:text-slate-600 ${
                        movementType === 'ingreso'
                          ? 'border-slate-800 text-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                          : 'border-slate-800 text-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      }`}
                    />
                    <span
                      className={`absolute right-3.5 top-3 text-xs font-mono font-bold ${
                        movementType === 'ingreso' ? 'text-emerald-400/90' : 'text-rose-400/90'
                      }`}
                    >
                      Bs.
                    </span>
                  </div>
                </div>

                {/* Tarjeta de cálculo y vista previa en tiempo real para Efectivo */}
                <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-3 space-y-2 text-xs font-mono">
                  {/* Vista USD */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Dólares ($):</span>
                    <div className="flex items-center gap-1.5">
                      {deltaUsdNum > 0 && (
                        <span
                          className={`font-semibold ${
                            movementType === 'ingreso' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {movementType === 'ingreso' ? '+' : '-'}${formatSpanishNumber(deltaUsdNum)} ➔
                        </span>
                      )}
                      <span className="font-bold text-white tabular-nums">
                        ${formatSpanishNumber(finalUsdPreview)}
                      </span>
                    </div>
                  </div>

                  {/* Vista Bolívares */}
                  <div className="flex items-center justify-between border-t border-slate-800/80 pt-1.5">
                    <span className="text-slate-400">Bolívares (Bs.):</span>
                    <div className="flex items-center gap-1.5">
                      {deltaBsNum > 0 && (
                        <span
                          className={`font-semibold ${
                            movementType === 'ingreso' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {movementType === 'ingreso' ? '+' : '-'}Bs. {formatSpanishNumber(deltaBsNum)} ➔
                        </span>
                      )}
                      <span className="font-bold text-white tabular-nums">
                        Bs. {formatSpanishNumber(finalBsPreview)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Caso Cuentas Bancarias Regulares / Binance (1 sola moneda) */
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Monto a {movementType === 'ingreso' ? 'sumar' : 'restar'}:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={movementAmount}
                      onChange={(e) => handleGenericChange(e, setMovementAmount)}
                      autoFocus
                      disabled={isSubmitting}
                      placeholder="0,00"
                      className={`w-full bg-slate-950 border rounded-2xl px-3.5 py-3 text-xl font-mono font-bold focus:outline-none transition-all placeholder:text-slate-600 ${
                        movementType === 'ingreso'
                          ? 'border-slate-800 text-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                          : 'border-slate-800 text-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                      }`}
                    />
                    <span
                      className={`absolute right-3.5 top-3.5 text-xs font-mono font-bold ${
                        movementType === 'ingreso' ? 'text-emerald-400/90' : 'text-rose-400/90'
                      }`}
                    >
                      {currencyUnit}
                    </span>
                  </div>
                </div>

                {/* Tarjeta de cálculo y vista previa en tiempo real para Bancos */}
                <div className="bg-slate-950/90 border border-slate-800/90 rounded-2xl p-3.5 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Saldo en servidor:</span>
                    <span className="font-semibold text-slate-300 tabular-nums">
                      {formatSpanishNumber(currentRegularNum)} {currencyUnit}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">
                      {movementType === 'ingreso' ? 'Ingreso (+):' : 'Egreso (-):'}
                    </span>
                    <span
                      className={`font-bold tabular-nums flex items-center gap-1 ${
                        movementType === 'ingreso' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {movementType === 'ingreso' ? '+' : '-'} {formatSpanishNumber(deltaRegularNum)}{' '}
                      {currencyUnit}
                    </span>
                  </div>

                  <div className="border-t border-slate-800 pt-2 flex items-center justify-between">
                    <span className="font-bold text-white">Nuevo saldo resultante:</span>
                    <span
                      className={`font-extrabold text-sm sm:text-base tabular-nums ${
                        movementType === 'ingreso' ? 'text-emerald-400' : 'text-white'
                      }`}
                    >
                      {formatSpanishNumber(finalRegularPreview)} {currencyUnit}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Botones de acción Ingreso / Egreso */}
            <div className="flex gap-2.5 justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white rounded-xl border border-slate-800 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  (isEfectivo
                    ? deltaUsdNum <= 0 && deltaBsNum <= 0
                    : deltaRegularNum <= 0)
                }
                className={`px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50 disabled:pointer-events-none rounded-xl flex items-center gap-2 transition-all shadow-lg ${
                  movementType === 'ingreso'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/50'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-950/50'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Aplicando...</span>
                  </>
                ) : (
                  <>
                    {movementType === 'ingreso' ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {movementType === 'ingreso' ? 'Aplicar Ingreso' : 'Aplicar Egreso'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
