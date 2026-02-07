export interface ExchangeFundingRate {
  exchange: string;
  exchangeId: string;
  symbol: string;
  pair: string;
  fundingRate: number;
  nextFundingTimestamp: number;
  markPrice: number | null;
  volume24h: number | null;
}

export interface CoinGroup {
  symbol: string;
  maxAbsFundingRate: number;
  nextSettlement: number;
  exchangeCount: number;
  exchanges: ExchangeFundingRate[];
}

export interface FundingRateResponse {
  coins: CoinGroup[];
  meta: {
    totalCoins: number;
    totalExchanges: number;
    lastUpdated: string;
    errors: string[];
  };
}
