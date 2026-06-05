export interface ScrapeJobData {
  jobType?: 'scrape';
  jobDbId: string;
  query: string;
  queryType: 'keyword' | 'url';
  filters: {
    minPrice?: number;
    maxPrice?: number;
    platforms?: string[];
    minRating?: number;
    availableOnly?: boolean;
    sortBy?: 'price_asc' | 'price_desc' | 'rating' | 'name';
    limit?: number;
  };
}

export interface PriceCheckJobData {
  jobType: 'price-check';
  trackedProductId: number;
  productUrl: string;
  platform: string;
  userId: number;
}

export interface AlertJobData {
  trackedProductId: number;
  userEmail: string;
  productName: string;
  productUrl: string;
  platform: string;
  newPrice: number;
  threshold: number;
  currency: string;
}

export type ScrapeQueueData = ScrapeJobData | PriceCheckJobData;
