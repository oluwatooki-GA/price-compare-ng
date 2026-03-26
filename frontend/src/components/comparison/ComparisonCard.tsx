import type { ComparisonResult } from '../../types';
import { ProductCard } from './ProductCard';
import { BestValueBadge } from './BestValueBadge';

interface ComparisonCardProps {
  comparison: ComparisonResult;
  onSave?: () => void;
  isSaving?: boolean;
}

export const ComparisonCard = ({ comparison, onSave, isSaving }: ComparisonCardProps) => {
  // Safety checks
  if (!comparison || !comparison.products || !Array.isArray(comparison.products)) {
    return null;
  }

  const bestProduct = comparison.products[comparison.bestValueIndex];
  
  const calculatePriceDifference = (price: number) => {
    if (!bestProduct) return null;
    const diff = price - bestProduct.price;
    const percentage = ((diff / bestProduct.price) * 100).toFixed(1);
    return { amount: diff, percentage };
  };

  return (
    <div className="bg-[#161616] rounded-2xl border border-[#262626] p-8 mb-8 shadow-2xl">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">{comparison.searchQuery}</h2>
          <p className="text-sm text-slate-400">
            {comparison.products.length} results found
          </p>
        </div>
        {onSave && (
          <button
            onClick={onSave}
            disabled={isSaving}
            className="px-6 py-3 bg-[#1edc6a] text-[#0A0A0A] rounded-lg font-bold hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {isSaving ? 'Saving...' : 'Save Comparison'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {comparison.products.map((product, index) => (
          <div key={index} className="relative">
            {index === comparison.bestValueIndex && (
              <div className="absolute -top-3 -right-3 z-10">
                <BestValueBadge />
              </div>
            )}
            <ProductCard
              product={product}
              isBestValue={index === comparison.bestValueIndex}
            />
            {index !== comparison.bestValueIndex && bestProduct && (
              <div className="mt-3 text-sm text-slate-400 text-center">
                {(() => {
                  const diff = calculatePriceDifference(product.price);
                  return diff ? (
                    <span>
                      +{product.currency} {diff.amount.toLocaleString()} ({diff.percentage}% more)
                    </span>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
