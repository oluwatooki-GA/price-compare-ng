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

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface JobResponse {
  jobId: string;
  status: JobStatus;
  results?: ComparisonResult[];
  count?: number;
  error?: string | null;
  createdAt?: string;
  completedAt?: string | null;
  cached?: boolean;
}

export interface TrackedPriceHistoryEntry {
  id: number;
  price: number;
  currency: string;
  availability: boolean;
  recordedAt: string;
}

export interface TrackedProduct {
  id: number;
  userId: number;
  productUrl: string;
  productName: string;
  platform: string;
  imageUrl: string | null;
  searchQuery: string | null;
  lastKnownPrice: number | null;
  alertThreshold: number | null;
  alertEnabled: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt: string | null;
  priceHistory: TrackedPriceHistoryEntry[];
}

export interface DashboardSummary {
  trackedProducts: TrackedProduct[];
  count: number;
}
