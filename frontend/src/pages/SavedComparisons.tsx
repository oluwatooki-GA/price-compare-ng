import { useState } from 'react';
import { useComparisons } from '../hooks/useComparisons';
import { ProductCard } from '../components/comparison/ProductCard';
// import { BestValueBadge } from '../components/comparison/BestValueBadge'; // TODO: Re-enable when needed
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/button';
import { ArrowLeft, Trash2, Search, BookmarkX, ChevronRight } from 'lucide-react';

// ── Group saved comparisons by their searchQuery ──────────────────────────────

interface SavedItem {
  id: number;
  searchQuery: string;
  searchType: string;
  comparisonData: any;
  createdAt: string | Date;
}

interface SearchGroup {
  searchQuery: string;
  items: SavedItem[];
  savedAt: Date;
}

function groupBySearch(items: SavedItem[]): SearchGroup[] {
  const map = new Map<string, SavedItem[]>();
  for (const item of items) {
    const key = item.searchQuery;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries())
    .map(([searchQuery, groupItems]) => ({
      searchQuery,
      items: groupItems,
      // Most recent save date for the group
      savedAt: new Date(
        Math.max(...groupItems.map(i => new Date(i.createdAt).getTime()))
      ),
    }))
    .sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
}

// ── Group card on the list page ───────────────────────────────────────────────

const GroupCard = ({
  group,
  onClick,
}: {
  group: SearchGroup;
  onClick: () => void;
}) => {
  // Show thumbnails of first 3 products
  const previews = group.items
    .slice(0, 3)
    .map(i => i.comparisonData?.products?.[0])
    .filter(Boolean);

  const lowestPrice = Math.min(
    ...group.items
      .map(i => i.comparisonData?.products?.[0]?.price)
      .filter(Boolean)
  );

  return (
    <motion.button
      onClick={onClick}
      className="w-full text-left bg-[#161616] border border-[#262626] hover:border-[#333] rounded-2xl p-6 transition-all group cursor-pointer"
      whileHover={{ y: -2 }}
      whileTap={{ y: 1 }}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Thumbnail stack */}
        <div className="flex -space-x-3 flex-shrink-0">
          {previews.map((p, i) => (
            <div
              key={i}
              className="w-12 h-12 rounded-lg border-2 border-[#161616] bg-[#1a1a1a] overflow-hidden flex-shrink-0"
              style={{ zIndex: previews.length - i }}
            >
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">📦</div>
              )}
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2 group-hover:text-[#1edc6a] transition-colors">
            {group.searchQuery}
          </h3>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs text-slate-500">
              {group.items.length} saved product{group.items.length !== 1 ? 's' : ''}
            </span>
            <span className="text-xs text-slate-600">·</span>
            <span className="text-xs text-slate-500">
              {group.savedAt.toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Price + chevron */}
        <div className="flex-shrink-0 text-right">
          {lowestPrice > 0 && (
            <div className="text-[#1edc6a] font-bold text-sm">
              from ₦{lowestPrice.toLocaleString()}
            </div>
          )}
          <div className="text-slate-600 text-xs mt-1 group-hover:text-slate-400 transition-colors flex items-center justify-end gap-1">
            View all
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </motion.button>
  );
};

// ── Detail page for a single search group ────────────────────────────────────

const GroupDetail = ({
  group,
  onBack,
  onDelete,
  isDeleting,
}: {
  group: SearchGroup;
  onBack: () => void;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}) => {
  // Best value = cheapest available product in this group
  let products = group.items
    .map(i => ({ item: i, product: i.comparisonData?.products?.[0] }))
    .filter(x => x.product);

  const bestValueUrl = (() => {
    const available = products.filter(x => x.product.availability);
    const pool = available.length ? available : products;
    if (!pool.length) return null;
    return pool.reduce((a, b) =>
      a.product.price < b.product.price ? a : b
    ).product.url;
  })();

  // Sort so best value product comes first
  if (bestValueUrl) {
    products = [...products].sort((a, b) => {
      if (a.product.url === bestValueUrl) return -1;
      if (b.product.url === bestValueUrl) return 1;
      return 0;
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
    >
      {/* Back + heading */}
      <motion.div whileHover={{ x: -5 }} whileTap={{ y: 1 }} className="inline-block mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-[#1edc6a] hover:text-[#17c55e] transition-colors -ml-4 cursor-pointer">
          <ArrowLeft className="w-5 h-5" />
          Back to saved
        </button>
      </motion.div>

      <h2 className="text-2xl font-bold text-white mb-1 line-clamp-2">
        {group.searchQuery}
      </h2>
      <p className="text-slate-500 text-sm mb-8">
        {group.items.length} saved product{group.items.length !== 1 ? 's' : ''}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map(({ item, product }, i) => (
          <motion.div
            key={item.id}
            className="relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <ProductCard
              product={product}
              isBestValue={product.url === bestValueUrl}
            />

            {/* Delete button — fixed position inside the card, never shifts layout */}
            <button
              onClick={() => onDelete(item.id)}
              disabled={isDeleting}
              title="Remove from saved"
              className="absolute top-3 left-3 w-7 h-7 flex items-center justify-center rounded-full bg-[#0A0A0A]/80 border border-[#333] text-slate-500 hover:text-red-400 hover:border-red-400/40 transition-all disabled:opacity-40 backdrop-blur-sm cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

export const SavedComparisons = () => {
  const { comparisons, deleteComparison } = useComparisons();
  const [activeGroup, setActiveGroup] = useState<SearchGroup | null>(null);

  if (comparisons.isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (comparisons.isError) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] py-12">
        <div className="container mx-auto px-8 md:px-12 lg:px-16">
          <ErrorMessage
            message="Failed to load saved comparisons"
            onRetry={() => comparisons.refetch()}
          />
        </div>
      </div>
    );
  }

  const savedItems: SavedItem[] = comparisons.data || [];
  const groups = groupBySearch(savedItems);

  // When an item is deleted and the active group becomes empty, go back to list
  const handleDelete = (id: number) => {
    deleteComparison.mutate(id, {
      onSuccess: () => {
        if (activeGroup) {
          const remaining = activeGroup.items.filter(i => i.id !== id);
          if (remaining.length === 0) {
            setActiveGroup(null);
          } else {
            setActiveGroup({ ...activeGroup, items: remaining });
          }
        }
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] py-8 sm:py-12">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-16">

        <AnimatePresence mode="wait">

          {/* ── Detail view ── */}
          {activeGroup ? (
            <GroupDetail
              key="detail"
              group={activeGroup}
              onBack={() => setActiveGroup(null)}
              onDelete={handleDelete}
              isDeleting={deleteComparison.isPending}
            />
          ) : (

          /* ── List view ── */
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.25 }}
          >
            <motion.h1
              className="text-4xl font-bold text-white mb-8"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              Saved Comparisons
            </motion.h1>

            {groups.length === 0 ? (
              <div className="text-center py-20">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 rounded-full bg-[#262626] flex items-center justify-center">
                    <BookmarkX className="w-10 h-10 text-slate-600" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">No saved comparisons yet</h2>
                <p className="text-slate-400 mb-8">
                  Save products from search results to compare them here
                </p>
                <a href="/">
                  <Button size="lg" className="gap-2">
                    <Search className="w-5 h-5" />
                    Start Searching
                  </Button>
                </a>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {groups.map((group, i) => (
                  <motion.div
                    key={group.searchQuery}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <GroupCard
                      group={group}
                      onClick={() => setActiveGroup(group)}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};