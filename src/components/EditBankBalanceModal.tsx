import React, { useState, useEffect } from 'react';
import { BankAccount } from '../types/dashboard';
import { X, Check, Landmark, Gem, Send, Loader2 } from 'lucide-react';

interface EditBankBalanceModalProps {
  isOpen: boolean;
  account: BankAccount | null;
  onClose: () => void;
  onSave: (bankName: string, monto: number, bankId: string) => Promise<void>;
}

export const EditBankBalanceModal: React.FC<EditBankBalanceModalProps> = ({
  isOpen,
  account,
  onClose,
  onSave,
}) => {
  const [balanceInput, setBalanceInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (account) {
      setBalanceInput(String(account.balanceNative));
    }
  }, [account, isOpen]);

  if (!isOpen || !account) return null;

  const isBinance =
    account.id === 'binance' ||
    account.bankName.toLowerCase().includes('binance') ||
    account.bankShort.toLowerCase().includes('binance');

  const currencyUnit = isBinance ? 'USDT' : account.nativeCurrency === 'USD' ? 'USD' : 'Bs.';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(balanceInput.replace(/,/g, '.'));
    if (isNaN(num) || num < 0) return;

    setIsSubmitting(true);
    try {
      // Nombre de banco que se enviará en el webhook (ej: BDV, BANESCO, BNC, etc.)
      const bankNameToSend = account.bankShort || account.bankId || account.bankName;
      await onSave(bankNameToSend, num, account.id);
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
        {/* Encabezado con Icono del Banco y Botón Cerrar */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center border bg-slate-800/80 border-slate-700/50">
              {isBinance ? (
                <Gem className="w-5 h-5 text-slate-400" />
              ) : (
                <Landmark className="w-5 h-5 text-slate-400" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {account.bankShort}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {isBinance ? '1272204580' : account.accountNumber || account.bankName}
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
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Saldo actual ({currencyUnit}):
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                autoFocus
                disabled={isSubmitting}
                placeholder="0.00"
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3.5 py-3 text-xl font-mono font-bold text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-600"
              />
              <span className="absolute right-3.5 top-3.5 text-xs font-mono font-semibold text-slate-400">
                {currencyUnit}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 font-mono flex items-center gap-1.5">
              <Send className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>
                Se enviará webhook a Google Apps Script: <strong className="text-slate-300">exe?banco={account.bankShort}&monto=[saldo]</strong>
              </span>
            </p>
          </div>

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
              disabled={isSubmitting || !balanceInput}
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
