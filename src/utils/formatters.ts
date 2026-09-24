import { CurrencyType, ForeignCurrency } from '../types/dashboard';

/**
 * Formatea un número usando '.' para miles y ',' para decimales (formato es-VE/es-ES)
 * Si el monto es 0, retorna '-'
 * Ejemplos: 1.234.567,89 / 853,50 / -
 */
export function formatAmountNumber(amount: number, decimals: number = 2): string {
  const val = isNaN(amount) || amount === null || amount === undefined ? 0 : amount;
  if (Math.abs(val) < 0.00001) return '-';
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

export function formatRate(rate: number): string {
  if (isNaN(rate) || rate === null || rate === undefined || rate <= 0) return '-';
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rate);
}

export function formatBs(amount: number): string {
  const val = isNaN(amount) || amount === null || amount === undefined ? 0 : amount;
  if (Math.abs(val) < 0.00001) return '-';
  return `Bs. ${formatAmountNumber(val, 2)}`;
}

export function formatForeign(amount: number, currency: ForeignCurrency = 'USD'): string {
  const symbol = currency === 'EUR' ? '€' : '$';
  const val = isNaN(amount) || amount === null || amount === undefined ? 0 : amount;
  if (Math.abs(val) < 0.00001) return '-';
  return `${symbol} ${formatAmountNumber(val, 2)}`;
}

export function formatUSD(amount: number): string {
  return formatForeign(amount, 'USD');
}

export function convertValue(
  amount: number,
  from: CurrencyType,
  to: CurrencyType,
  rate: number
): number {
  if (from === to) return amount;
  if (!rate || rate <= 0) return 0;
  if (from === 'VES' && (to === 'USD' || to === 'EUR')) return amount / rate;
  if ((from === 'USD' || from === 'EUR') && to === 'VES') return amount * rate;
  return amount;
}

export function parseAmount(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).trim().replace(/Bs\.?/gi, '').replace(/\$/g, '').replace(/€/g, '').trim();
  if (!str) return 0;
  if (str.includes(',') && str.includes('.')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 4) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

export function parseFlexibleDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  const str = String(val).trim();
  if (!str) return null;

  // Intentar parse directo (ISO, etc.)
  const direct = new Date(str);
  if (!isNaN(direct.getTime())) {
    return direct;
  }

  // Formato DD/MM/YYYY o DD-MM-YYYY (con hora HH:mm:ss y posible AM/PM o a.m./p.m.)
  const dmyMatch = str.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s*[, ]\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s*(am|pm|a\.?\s*m\.?|p\.?\s*m\.?)?)?/i
  );
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    let hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const ampm = dmyMatch[7] ? dmyMatch[7].toLowerCase().replace(/\s|\./g, '') : '';

    if (ampm === 'pm' && hour < 12) {
      hour += 12;
    } else if (ampm === 'am' && hour === 12) {
      hour = 0;
    }

    const customDate = new Date(year, month, day, hour, min, sec);
    if (!isNaN(customDate.getTime())) return customDate;
  }

  return null;
}

export function isOlderThanMinutes(val: unknown, minutes: number): boolean {
  if (!val) return true;
  const date = parseFlexibleDate(val);
  if (!date) return true;
  const diffMs = Date.now() - date.getTime();
  return diffMs > minutes * 60 * 1000;
}

export function isOlderThanOneHour(val: unknown): boolean {
  return isOlderThanMinutes(val, 60);
}

export function isOlderThanOneHourAndHalf(val: unknown): boolean {
  return isOlderThanMinutes(val, 90); // Supera 1 hora y media (90 minutos)
}

const MONTHS_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

export function formatSmartUpdateTime(val: unknown): string {
  if (!val) return '';
  const date = parseFlexibleDate(val);
  if (!date) return '';

  const now = Date.now();
  const diffMs = Math.max(0, now - date.getTime());
  const diffMins = Math.floor(diffMs / 60000);

  // Menos de 1 hora: mostrar minutos
  if (diffMins < 1) return '< 1 min';
  if (diffMins === 1) return '1 min';
  if (diffMins < 60) return `${diffMins} min`;

  // Entre 1 hora y 24 horas: mostrar solo las horas (1h, 2h, 3h, etc.)
  const hours = Math.floor(diffMins / 60);
  if (hours < 24) {
    return `${hours}h`;
  }

  // Más de 24 horas: mostrar fecha con formato "08 Ago"
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS_ES[date.getMonth()] || '';
  return `${day} ${month}`;
}
