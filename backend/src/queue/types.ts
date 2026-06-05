export interface ScrapeJobData {
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
