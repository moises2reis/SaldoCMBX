import { BinanceBreakdown } from '../types/dashboard';

export async function fetchBinanceBalance(): Promise<BinanceBreakdown | null> {
  try {
    const res = await fetch('/api/binance/balance');
    if (res.ok) {
      const data = await res.json();
      return data.binance;
    }
  } catch (err) {
    console.warn('Error fetching binance balance:', err);
  }
  return null;
}

export async function syncBinanceServer(): Promise<BinanceBreakdown | null> {
  try {
    const res = await fetch('/api/binance/sync', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      return data.binance;
    }
  } catch (err) {
    console.warn('Error syncing binance on server:', err);
  }
  return null;
}
