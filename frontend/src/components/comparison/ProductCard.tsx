import type { ProductData } from '../../types';
import { ExternalLink, Star, Package } from 'lucide-react';

interface ProductCardProps {
  product: ProductData;
  isBestValue?: boolean;
}

export const ProductCard = ({ product, isBestValue }: ProductCardProps) => {
  return (
    <div
      className={`flex flex-col h-full p-6 rounded-xl border transition-all ${
        isBestValue
          ? 'border-[#1edc6a] border-2 bg-[#1edc6a]/5'
          : 'border-[#262626] bg-[#0A0A0A]/50'
      }`}
    >
      {/* Image or placeholder - fixed height */}
      <div className="w-full h-48 mb-4 flex items-center justify-center bg-[#1a1a1a] rounded-lg overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Package className="w-16 h-16 text-slate-600" />
        )}
      </div>

      {/* Content area - grows to fill available space */}
      <div className="flex flex-col flex-1 space-y-3">
        <h3 className="font-semibold text-lg line-clamp-2 text-white flex-1">
          {product.name}
        </h3>

        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${isBestValue ? 'text-[#1edc6a]' : 'text-white'}`}>
            {product.currency} {product.price.toLocaleString()}
          </span>
        </div>

        {/* Rating - fixed height even when null */}
        <div className="flex items-center gap-2 text-sm min-h-[20px]">
          {product.rating !== null ? (
            <>
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-white">{product.rating.toFixed(1)}</span>
              <span className="text-slate-400">({product.reviewCount} reviews)</span>
            </>
          ) : (
            <span className="text-slate-500">No ratings</span>
          )}
        </div>

        {/* Platform and stock - fixed height */}
        <div className="flex items-center justify-between min-h-[24px]">
          <span className="text-sm font-medium text-slate-400 uppercase">
            {product.platform}
          </span>
          {!product.availability && (
            <span className="text-sm text-red-400 font-medium">Out of Stock</span>
          )}
        </div>

        {/* Button - always at bottom */}
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center gap-2 w-full text-center py-3 px-4 rounded-lg font-medium transition-all cursor-pointer active:translate-y-0.5 ${
            isBestValue
              ? 'bg-[#1edc6a] text-[#0A0A0A] hover:bg-[#17c55e] shadow-lg hover:shadow-md active:shadow-sm'
              : 'bg-[#262626] text-white hover:bg-[#1a1a1a] shadow-lg hover:shadow-md active:shadow-sm'
          }`}
        >
          View Product
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
};
