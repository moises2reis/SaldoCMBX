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

export const SimpleEditModal: React.FC<SimpleEditModalProps> = ({
  isOpen,
  onClose,
  title,
  label,
  initialValue,
  currencySymbol,
  onSave,
}) => {
  const [val, setVal] = useState(initialValue.toString());

  useEffect(() => {
    setVal(initialValue.toString());
  }, [initialValue, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(val);
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
                type="number"
                step="0.01"
                min="0"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                autoFocus
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
