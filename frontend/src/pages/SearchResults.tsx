import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ErrorMessage } from '../components/common/ErrorMessage';
import type { ComparisonResult } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useComparisons } from '../hooks/useComparisons';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/button';
import { useState, useMemo, useEffect } from 'react';
import { useSearch } from '../hooks/useSearch';
import { ProductCard } from '../components/comparison/ProductCard';

const PAGE_SIZE = 20;
type SortBy = 'price_asc' | 'price_desc' | 'rating' | 'name';

export const SearchResults = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { saveComparison } = useComparisons();
  const { searchByKeyword } = useSearch();

  // Query from state (normal navigation) or URL param (direct link / refresh)
  const query = (location.state?.query as string | undefined)
    ?? searchParams.get('q')
    ?? undefined;

  const initialResults: ComparisonResult[] = Array.isArray(location.state?.results)
    ? location.state.results
    : [];

  const [results, setResults] = useState<ComparisonResult[]>(initialResults);
  const [savedUrls, setSavedUrls] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortBy>(
    (searchParams.get('sortBy') as SortBy | null) ?? 'price_asc'
  );
  const [page, setPage] = useState(0);

  // If we landed here via direct URL with no state (refresh / shared link),
  // re-run the search with the same filters encoded in the URL.
  // Read directly from window.location.search to guarantee params are available
  // at mount time regardless of React Router's render cycle.
  useEffect(() => {
    if (initialResults.length === 0 && query) {
      const raw       = new URLSearchParams(window.location.search);
      const minPrice  = Number(raw.get('minPrice'))  || undefined;
      const maxPrice  = Number(raw.get('maxPrice'))  || undefined;
      const minRating = Number(raw.get('minRating')) || undefined;
      console.log('[SearchResults] re-fetching from URL params:', { query, minPrice, maxPrice, minRating });
      searchByKeyword.mutate(
        { keyword: query, minPrice, maxPrice, minRating, limit: 20 },
        { onSuccess: (data: ComparisonResult[]) => setResults(data) }
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps - run once on mount

  // Sort the full result set client-side - no backend call
  const sorted = useMemo(() => {
    return [...results].sort((a, b) => {
      const pa = a.products[0];
      const pb = b.products[0];
      switch (sortBy) {
        case 'price_asc':  return pa.price - pb.price;
        case 'price_desc': return pb.price - pa.price;
        case 'rating':     return (pb.rating ?? 0) - (pa.rating ?? 0);
        case 'name':       return pa.name.localeCompare(pb.name);
        default:           return 0;
      }
    });
  }, [results, sortBy]);

  // Flatten to products, keeping parent result for save
  const allProducts = useMemo(
    () => sorted.filter(r => r.products?.[0]).map(r => ({ product: r.products[0], result: r })),
    [sorted]
  );

  // Best value = cheapest available product, pinned to position 0
  const bestValueEntry = useMemo(() => {
    const available = allProducts.filter(x => x.product.availability);
    const pool = available.length ? available : allProducts;
    return pool.length ? pool.reduce((a, b) => a.product.price < b.product.price ? a : b) : null;
  }, [allProducts]);
  const bestValueUrl = bestValueEntry?.product.url ?? null;

  const pinnedProducts = useMemo(() => {
    if (!bestValueEntry) return allProducts;
    return [bestValueEntry, ...allProducts.filter(x => x.product.url !== bestValueUrl)];
  }, [allProducts, bestValueEntry, bestValueUrl]);

  const totalPages = Math.ceil(pinnedProducts.length / PAGE_SIZE);
  const pageItems  = pinnedProducts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const goToPage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSave = (result: ComparisonResult) => {
    const productUrl  = result.products[0]?.url;
    const productName = result.products[0]?.name;

    if (productUrl && savedUrls.has(productUrl)) {
      toast('Already saved', { icon: 'ℹ️' });
      return;
    }

    const comparisonData = { 
      ...result, 
      timestamp: typeof result.timestamp === 'string' 
        ? result.timestamp 
        : (result.timestamp as Date).toISOString() 
    };

    saveComparison.mutate(
      { comparisonData },
      {
        onSuccess: () => {
          if (productUrl) setSavedUrls(prev => new Set(prev).add(productUrl));
          toast.success(productName ? `Saved: ${productName.slice(0, 40)}…` : 'Saved!');
        },
        onError: (error: any) => {
          if (error.response?.status === 400 && error.response?.data?.message?.includes('limit')) {
            toast.error('Limit reached - max 50 saved comparisons');
          } else {
            toast.error(error.response?.data?.message ?? 'Failed to save, please try again');
          }
        },
      }
    );
  };

  if (!query || (allProducts.length === 0 && !searchByKeyword.isPending)) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] py-12">
        <div className="container mx-auto px-8 md:px-12 lg:px-16">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <ErrorMessage message="No results found" onRetry={() => navigate('/')} />
          </motion.div>
        </div>
      </div>
    );
  }

  if (searchByKeyword.isPending) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-slate-400 text-center"
        >
          <div className="text-3xl mb-4 animate-spin inline-block">⟳</div>
          <p>Loading results for "{query}"…</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] py-8 sm:py-12">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-16">

        {/* Back */}
        <motion.div className="mb-8" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <motion.div whileHover={{ x: -5 }} whileTap={{ y: 1 }}>
            <Button
              onClick={() => navigate('/')}
              variant="ghost"
              className="text-[#1edc6a] hover:text-[#1edc6a] hover:brightness-110 -ml-4 cursor-pointer"
            >
              ← Back to Search
            </Button>
          </motion.div>
        </motion.div>

        {/* Heading + sort */}
        <motion.div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="w-full sm:w-auto">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Search Results</h1>
            <p className="text-slate-400 text-xs sm:text-sm">
              {pinnedProducts.length} product{pinnedProducts.length !== 1 ? 's' : ''} for{' '}
              <span className="text-white font-medium">"{query}"</span>
              {totalPages > 1 && (
                <span className="ml-2 text-slate-500">- page {page + 1} of {totalPages}</span>
              )}
            </p>
          </div>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={e => { setSortBy(e.target.value as SortBy); setPage(0); }}
            className="w-full sm:w-auto h-9 bg-[#161616] border border-[#262626] focus:border-[#1edc6a] rounded-lg px-3 text-sm text-white outline-none transition-colors"
          >
            <option value="price_asc">Price: Low → High</option>
            <option value="price_desc">Price: High → Low</option>
            <option value="rating">Highest Rated</option>
            <option value="name">Name A–Z</option>
          </select>
        </motion.div>

        {/* Product grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pageItems.map(({ product, result }, i) => (
            <motion.div
              key={`${product.url}-${i}`}
              className="relative"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
            >
              <ProductCard
                product={product}
                isBestValue={product.url === bestValueUrl}
              />
              <button
                onClick={() => isAuthenticated ? handleSave(result) : toast('Login to save comparisons', { icon: '🔒' })}
                disabled={saveComparison.isPending}
                className={`absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded backdrop-blur-sm transition-colors disabled:opacity-50 cursor-pointer ${
                  savedUrls.has(product.url)
                    ? 'bg-[#1edc6a]/20 text-[#1edc6a]'
                    : 'bg-[#262626]/80 text-slate-400 hover:text-white hover:bg-[#333]'
                }`}
              >
                {saveComparison.isPending ? '…' : savedUrls.has(product.url) ? '✓' : 'Save'}
              </button>
            </motion.div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <motion.div
            className="flex items-center justify-center gap-2 mt-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Button variant="outline" size="sm" onClick={() => goToPage(page - 1)} disabled={page === 0}>
              ← Prev
            </Button>
            {Array.from({ length: totalPages }, (_, i) => (
              <Button
                key={i}
                variant={i === page ? 'default' : 'outline'}
                size="sm"
                onClick={() => goToPage(i)}
                className={i === page ? 'bg-[#1edc6a] text-black hover:bg-[#1edc6a]/90 border-[#1edc6a]' : ''}
              >
                {i + 1}
              </Button>
            ))}
            <Button variant="outline" size="sm" onClick={() => goToPage(page + 1)} disabled={page === totalPages - 1}>
              Next →
            </Button>
          </motion.div>
        )}

      </div>
    </div>
  );
};