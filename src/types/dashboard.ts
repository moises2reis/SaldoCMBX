export type ForeignCurrency = 'USD' | 'EUR' | 'P2P';
export type CurrencyType = 'VES' | 'USD' | 'EUR';

export interface ExchangeRates {
  bcv: number;
  bcvUsd: number;
  bcvEur: number;
  binanceP2p?: number;
  fechaValor?: string;
  tasaUsdAnterior?: number;
  tasaEurAnterior?: number;
  fechaTasaAnterior?: string;
  lastUpdated: string;
}

export interface BankAccount {
  id: string;
  bankId: string;
  bankName: string;
  bankShort: string;
  accountType: string;
  accountNumber: string;
  categoria?: string;
  nativeCurrency: CurrencyType;
  balanceNative: number;
  montoUsd?: number;
  lastSync: string;
  linkActualizar?: string;
}

export interface BinanceAssetItem {
  asset: string;
  amount: number;
  valueUsd: number;
  wallet?: string;
}

export interface BinanceBreakdown {
  totalUsd: number;
  spotUsd: number;
  fundingUsd: number;
  flexibleUsd?: number;
  earnFlexibleUsd?: number;
  earnLockedUsd?: number;
  futuresUsd?: number;
  otherUsd?: number;
  topAssets?: BinanceAssetItem[];
  lastSync: string;
  status: 'ok' | 'location_restricted' | 'error' | 'synced';
  errorMsg?: string;
}
