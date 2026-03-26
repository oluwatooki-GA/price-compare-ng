export interface ProductData {
  platform: string;
  name: string;
  price: number;
  currency: string;
  rating: number | null;
  reviewCount: number;
  url: string;
  availability: boolean;
  imageUrl: string | null;
}

export interface ComparisonResult {
  products: ProductData[];
  bestValueIndex: number;
  searchQuery: string;
  timestamp: string;
}

export interface SavedComparison {
  id: number;
  searchQuery: string;
  searchType: 'keyword' | 'url';
  comparisonData: ComparisonResult;
  createdAt: string;
}

export interface User {
  id: number;
  email: string;
  createdAt: string;
}
