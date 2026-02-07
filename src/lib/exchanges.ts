import ccxt, { type Exchange } from 'ccxt';

const PROXY = process.env.HTTPS_PROXY || '';

const BASE_CONFIG: Record<string, unknown> = {
  enableRateLimit: true,
  timeout: 30000,
  options: { defaultType: 'swap' },
  ...(PROXY ? { httpsProxy: PROXY } : {}),
};

export interface ExchangeConfig {
  id: string;
  name: string;
  createInstance: () => Exchange;
}

export const EXCHANGE_CONFIGS: ExchangeConfig[] = [
  {
    id: 'binance',
    name: 'Binance',
    createInstance: () => new ccxt.binance({ ...BASE_CONFIG }),
  },
  {
    id: 'okx',
    name: 'OKX',
    createInstance: () => new ccxt.okx({ ...BASE_CONFIG }),
  },
  {
    id: 'bybit',
    name: 'Bybit',
    createInstance: () => new ccxt.bybit({ ...BASE_CONFIG }),
  },
  {
    id: 'gate',
    name: 'Gate.io',
    createInstance: () => new ccxt.gate({ ...BASE_CONFIG }),
  },
  {
    id: 'bitget',
    name: 'Bitget',
    createInstance: () => new ccxt.bitget({ ...BASE_CONFIG }),
  },
  {
    id: 'htx',
    name: 'HTX',
    createInstance: () => new ccxt.htx({ ...BASE_CONFIG }),
  },
];
