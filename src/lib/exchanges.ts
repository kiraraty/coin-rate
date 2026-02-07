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
  mode: 'batch' | 'single';
  createInstance: () => Exchange;
}

export const EXCHANGE_CONFIGS: ExchangeConfig[] = [
  {
    id: 'binance',
    name: 'Binance',
    mode: 'batch',
    createInstance: () => new ccxt.binance({ ...BASE_CONFIG }),
  },
  {
    id: 'okx',
    name: 'OKX',
    mode: 'batch',
    createInstance: () => new ccxt.okx({ ...BASE_CONFIG }),
  },
  {
    id: 'bybit',
    name: 'Bybit',
    mode: 'batch',
    createInstance: () => new ccxt.bybit({ ...BASE_CONFIG }),
  },
  {
    id: 'gate',
    name: 'Gate.io',
    mode: 'batch',
    createInstance: () => new ccxt.gate({ ...BASE_CONFIG }),
  },
  {
    id: 'bitget',
    name: 'Bitget',
    mode: 'single',
    createInstance: () => new ccxt.bitget({ ...BASE_CONFIG }),
  },
  {
    id: 'htx',
    name: 'HTX',
    mode: 'batch',
    createInstance: () => new ccxt.htx({ ...BASE_CONFIG }),
  },
  {
    id: 'coinex',
    name: 'CoinEx',
    mode: 'batch',
    createInstance: () => new ccxt.coinex({ ...BASE_CONFIG }),
  },
  {
    id: 'hyperliquid',
    name: 'Hyperliquid',
    mode: 'batch',
    createInstance: () => new ccxt.hyperliquid({ ...BASE_CONFIG }),
  },
  {
    id: 'mexc',
    name: 'MEXC',
    mode: 'single',
    createInstance: () => new ccxt.mexc({ ...BASE_CONFIG }),
  },
];
