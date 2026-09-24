import React, { useState, useEffect } from 'react';
import { BankAccount } from '../types/dashboard';
import { X, Check, Landmark, Gem, Banknote, Loader2 } from 'lucide-react';

interface EditBankBalanceModalProps {
  isOpen: boolean;
  account: BankAccount | null;
  onClose: () => void;
  onSave: (bankName: string, monto: number, bankId: string, montoUsd?: number) => Promise<void>;
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
}) => {
  const [balanceInput, setBalanceInput] = useState<string>('');
  const [montoBsInput, setMontoBsInput] = useState<string>('');
  const [montoUsdInput, setMontoUsdInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (account) {
      const isEf = account.categoria?.trim().toLowerCase() === 'efectivo';
      if (isEf) {
        setMontoBsInput(formatSpanishNumber(account.balanceNative));
        setMontoUsdInput(formatSpanishNumber(account.montoUsd || 0));
      } else {
        setBalanceInput(formatSpanishNumber(account.balanceNative));
      }
    }
  }, [account, isOpen]);

  if (!isOpen || !account) return null;

  const isEfectivo = account.categoria?.trim().toLowerCase() === 'efectivo';
  const isBinance =
    account.id === 'binance' ||
    account.bankName.toLowerCase().includes('binance') ||
    account.bankShort.toLowerCase().includes('binance');

  const currencyUnit = isBinance ? 'USDT' : account.nativeCurrency === 'USD' ? 'USD' : 'Bs.';

  const handleGenericChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const val = e.target.value;
    if (val && /[^\d.,]/.test(val)) return;
    setter(formatInputValue(val));
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Encabezado con Icono del Banco/Efectivo y Botón Cerrar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center border bg-slate-800/80 border-slate-700/50">
              {isBinance ? (
                <Gem className="w-5 h-5 text-slate-400" />
              ) : isEfectivo ? (
                <Banknote className="w-5 h-5 text-slate-400" />
              ) : (
                <Landmark className="w-5 h-5 text-slate-400" />
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

        {/* Formulario de actualización */}
        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Botones de acción */}
          <div className="flex gap-2.5 justify-end pt-3">
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
                  <span>Enviando...</span>
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
      </div>
    </div>
  );
};
