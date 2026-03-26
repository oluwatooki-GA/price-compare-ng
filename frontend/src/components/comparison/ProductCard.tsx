import type { ProductData } from '../../types';

interface ProductCardProps {
  product: ProductData;
  isBestValue?: boolean;
}

export const ProductCard = ({ product, isBestValue }: ProductCardProps) => {
  return (
    <div
      className={`p-6 rounded-xl border transition-all ${
        isBestValue 
          ? 'border-[#1edc6a] border-2 bg-[#1edc6a]/5' 
          : 'border-[#262626] bg-[#0A0A0A]/50'
      }`}
    >
      {product.imageUrl && (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-48 object-cover rounded-lg mb-4"
        />
      )}
      
      <div className="space-y-3">
        <h3 className="font-semibold text-lg line-clamp-2 text-white">{product.name}</h3>
        
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${isBestValue ? 'text-[#1edc6a]' : 'text-white'}`}>
            {product.currency} {product.price.toLocaleString()}
          </span>
        </div>

        {product.rating !== null && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-yellow-400">★</span>
            <span className="text-white">{product.rating.toFixed(1)}</span>
            <span className="text-slate-400">({product.reviewCount} reviews)</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-400 uppercase">
            {product.platform}
          </span>
          {!product.availability && (
            <span className="text-sm text-red-400 font-medium">Out of Stock</span>
          )}
        </div>

        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`block w-full text-center py-3 px-4 rounded-lg font-medium transition-all cursor-pointer active:translate-y-0.5 ${
            isBestValue
              ? 'bg-[#1edc6a] text-[#0A0A0A] hover:bg-[#17c55e] shadow-lg hover:shadow-md active:shadow-sm'
              : 'bg-[#262626] text-white hover:bg-[#1a1a1a] shadow-lg hover:shadow-md active:shadow-sm'
          }`}
        >
          View Product
        </a>
      </div>
    </div>
  );
};
