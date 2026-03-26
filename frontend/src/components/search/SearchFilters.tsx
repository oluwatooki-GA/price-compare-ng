import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

export interface SearchFilters {
  priceRange: { min: number; max: number };
  platform: string[];
  rating: number;
  availability: boolean;
  sortBy: 'price_asc' | 'price_desc' | 'rating' | 'name';
}

interface SearchFiltersProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onReset: () => void;
  isLoading?: boolean;
}

export const SearchFiltersComponent = ({
                                         filters,
                                         onFiltersChange,
                                         onReset,
                                         isLoading,
                                       }: SearchFiltersProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // Local draft — only committed to parent when Apply is clicked
  const [draft, setDraft] = useState<SearchFilters>(filters);

  const updateDraft = (key: keyof SearchFilters, value: any) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  };

  const togglePlatform = (platform: string) => {
    const next = draft.platform.includes(platform)
        ? draft.platform.filter(p => p !== platform)
        : [...draft.platform, platform];
    updateDraft('platform', next);
  };

  const handleApply = () => {
    onFiltersChange(draft);
  };

  const handleReset = () => {
    const empty: SearchFilters = {
      priceRange: { min: 0, max: 0 },
      platform: [],
      rating: 0,
      availability: false,
      sortBy: 'price_asc',
    };
    setDraft(empty);
    onReset();
  };

  const PLATFORMS = ['jumia', 'jiji', 'temu', 'konga'] as const;

  return (
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Filters & Sort</h3>
            <div className="flex gap-2">
              <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(v => !v)}
              >
                {isExpanded ? 'Hide' : 'Show'} Filters
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Reset
              </Button>
            </div>
          </div>

          {/* Sort — always visible, applies immediately */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">Sort By</label>
            <select
                value={draft.sortBy}
                onChange={e => {
                  const val = e.target.value as SearchFilters['sortBy'];
                  updateDraft('sortBy', val);
                  // Sort doesn't require a re-search — just re-order locally
                  onFiltersChange({ ...draft, sortBy: val });
                }}
                className="w-full px-3 py-2 bg-[#0A0A0A]/50 border border-[#262626] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#1edc6a]"
            >
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
              <option value="name">Name A–Z</option>
            </select>
          </div>

          <motion.div
              initial={false}
              animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
          >
            <div className="space-y-6">
              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Price Range (₦)
                </label>
                <div className="flex gap-2">
                  <input
                      type="number"
                      placeholder="Min"
                      value={draft.priceRange.min || ''}
                      onChange={e =>
                          updateDraft('priceRange', {
                            ...draft.priceRange,
                            min: parseInt(e.target.value) || 0,
                          })
                      }
                      className="flex-1 px-3 py-2 bg-[#0A0A0A]/50 border border-[#262626] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#1edc6a]"
                  />
                  <input
                      type="number"
                      placeholder="Max"
                      value={draft.priceRange.max || ''}
                      onChange={e =>
                          updateDraft('priceRange', {
                            ...draft.priceRange,
                            max: parseInt(e.target.value) || 0,
                          })
                      }
                      className="flex-1 px-3 py-2 bg-[#0A0A0A]/50 border border-[#262626] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#1edc6a]"
                  />
                </div>
              </div>

              {/* Platforms */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(platform => (
                      <Button
                          key={platform}
                          variant={draft.platform.includes(platform) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => togglePlatform(platform)}
                          className="capitalize"
                      >
                        {platform}
                      </Button>
                  ))}
                </div>
              </div>

              {/* Minimum Rating */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Minimum Rating
                </label>
                <select
                    value={draft.rating}
                    onChange={e => updateDraft('rating', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 bg-[#0A0A0A]/50 border border-[#262626] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#1edc6a]"
                >
                  <option value={0}>Any Rating</option>
                  <option value={3}>3+ Stars</option>
                  <option value={4}>4+ Stars</option>
                  <option value={4.5}>4.5+ Stars</option>
                </select>
              </div>

              {/* Availability */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 cursor-pointer">
                  <input
                      type="checkbox"
                      checked={draft.availability}
                      onChange={e => updateDraft('availability', e.target.checked)}
                      className="w-4 h-4 text-[#1edc6a] bg-[#0A0A0A] border-[#262626] rounded focus:ring-[#1edc6a]"
                  />
                  In Stock Only
                </label>
              </div>

              {/* Apply button */}
              <Button
                  onClick={handleApply}
                  disabled={isLoading}
                  className="w-full"
              >
                {isLoading ? 'Searching…' : 'Apply Filters'}
              </Button>
            </div>
          </motion.div>
        </CardContent>
      </Card>
  );
};
