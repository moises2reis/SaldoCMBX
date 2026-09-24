import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

interface SimpleEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  label: string;
  initialValue: number;
  currencySymbol: string;
  onSave: (val: number) => void;
}

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

export const SimpleEditModal: React.FC<SimpleEditModalProps> = ({
  isOpen,
  onClose,
  title,
  label,
  initialValue,
  currencySymbol,
  onSave,
}) => {
  const [val, setVal] = useState(formatSpanishNumber(initialValue));

  useEffect(() => {
    setVal(formatSpanishNumber(initialValue));
  }, [initialValue, isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    if (!inputVal) {
      setVal('');
      return;
    }

    if (/[^\d.,]/.test(inputVal)) return;

    const endsWithSeparator = inputVal.endsWith(',') || inputVal.endsWith('.');

    if (inputVal.includes(',')) {
      const [intPart, ...decParts] = inputVal.split(',');
      const cleanInt = intPart.replace(/\D/g, '');
      const cleanDec = decParts.join('').replace(/\D/g, '').slice(0, 4);
      const formattedInt = cleanInt ? new Intl.NumberFormat('de-DE').format(BigInt(cleanInt)) : '';
      if (endsWithSeparator && cleanDec === '') {
        setVal(`${formattedInt || '0'},`);
      } else {
        setVal(cleanDec !== '' ? `${formattedInt || '0'},${cleanDec}` : formattedInt);
      }
    } else if (inputVal.includes('.')) {
      if (endsWithSeparator) {
        const cleanInt = inputVal.slice(0, -1).replace(/\D/g, '');
        const formattedInt = cleanInt ? new Intl.NumberFormat('de-DE').format(BigInt(cleanInt)) : '';
        setVal(`${formattedInt || '0'},`);
      } else {
        const cleanInt = inputVal.replace(/\D/g, '');
        setVal(cleanInt ? new Intl.NumberFormat('de-DE').format(BigInt(cleanInt)) : '');
      }
    } else {
      const cleanInt = inputVal.replace(/\D/g, '');
      setVal(cleanInt ? new Intl.NumberFormat('de-DE').format(BigInt(cleanInt)) : '');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseSpanishNumber(val);
    if (!isNaN(num) && num >= 0) {
      onSave(num);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">{label}</label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={val}
                onChange={handleInputChange}
                autoFocus
                placeholder="0,00"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-lg font-mono text-white focus:outline-none focus:border-emerald-500"
              />
              <span className="absolute right-3 top-3 text-xs font-mono text-slate-400">
                {currencySymbol}
              </span>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl border border-slate-800 hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
