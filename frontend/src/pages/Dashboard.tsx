import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Trash2, Bell, BellOff, Package, ExternalLink, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTrackedProducts } from '../hooks/useTrackedProducts';
import { Button } from '../components/ui/button';
import type { TrackedProduct } from '../types';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}

function formatPrice(price: number): string {
  return price.toLocaleString('en-NG');
}

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never checked';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface ProductCardProps {
  product: TrackedProduct;
  onDelete: (id: number) => void;
  onToggleAlert: (id: number, enabled: boolean, threshold?: number | null) => void;
  isDeleting: boolean;
  isUpdating: boolean;
}

const TrackedProductCard = ({ product, onDelete, onToggleAlert, isDeleting, isUpdating }: ProductCardProps) => {
  const [editingThreshold, setEditingThreshold] = useState(false);
  const [thresholdInput, setThresholdInput] = useState(
    product.alertThreshold ? String(Math.floor(product.alertThreshold)) : ''
  );

  const chartData = product.priceHistory.map(h => ({
    date: formatDate(h.recordedAt),
    price: h.price,
  }));

  const currency = product.priceHistory[0]?.currency ?? 'NGN';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-[#0A0A0A] border border-[#262626] rounded-xl p-5 flex flex-col gap-4"
    >
      {/* Header row */}
      <div className="flex gap-3">
        <div className="w-14 h-14 rounded-lg bg-[#1a1a1a] flex items-center justify-center flex-shrink-0 overflow-hidden">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.productName} className="w-full h-full object-cover" />
          ) : (
            <Package className="w-6 h-6 text-slate-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-sm line-clamp-2 leading-snug">{product.productName}</h3>
          <span className="text-xs text-slate-500 uppercase tracking-wider">{product.platform}</span>
        </div>
        <div className="flex items-start gap-2 flex-shrink-0">
          <a
            href={product.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-[#1edc6a] transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <button
            onClick={() => onDelete(product.id)}
            disabled={isDeleting}
            className="text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Price row */}
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-2xl font-bold text-[#1edc6a]">
            {currency} {product.lastKnownPrice != null ? formatPrice(product.lastKnownPrice) : '—'}
          </p>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(product.lastCheckedAt)}
          </p>
        </div>
        {product.alertThreshold != null && (
          <div className="text-right">
            <p className="text-xs text-slate-500">Alert at</p>
            <p className="text-sm font-medium text-amber-400">
              {currency} {formatPrice(product.alertThreshold)}
            </p>
          </div>
        )}
      </div>

      {/* Price history chart */}
      {chartData.length >= 2 ? (
        <div className="w-full h-28">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#161616', border: '1px solid #262626', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(v: number | undefined) => [`${currency} ${formatPrice(v ?? 0)}`, 'Price']}
              />
              <Line type="monotone" dataKey="price" stroke="#1edc6a" strokeWidth={2} dot={{ r: 3, fill: '#1edc6a' }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs text-slate-600 text-center py-2">Price history chart appears after the first re-check (every 3 days)</p>
      )}

      {/* Alert settings */}
      <div className="border-t border-[#1a1a1a] pt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Price alert</span>
          <button
            onClick={() => onToggleAlert(product.id, !product.alertEnabled, product.alertThreshold)}
            disabled={isUpdating}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all cursor-pointer disabled:opacity-50 ${
              product.alertEnabled
                ? 'bg-[#1edc6a]/15 text-[#1edc6a]'
                : 'bg-[#1a1a1a] text-slate-500 hover:text-white'
            }`}
          >
            {product.alertEnabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
            {product.alertEnabled ? 'On' : 'Off'}
          </button>
        </div>

        {product.alertEnabled && (
          editingThreshold ? (
            <div className="flex gap-2">
              <input
                type="number"
                value={thresholdInput}
                onChange={e => setThresholdInput(e.target.value)}
                className="flex-1 bg-[#0A0A0A] border border-[#1edc6a] rounded px-2 py-1 text-xs text-white outline-none"
                autoFocus
              />
              <button
                onClick={() => {
                  const val = parseFloat(thresholdInput);
                  if (!isNaN(val) && val > 0) {
                    onToggleAlert(product.id, true, val);
                  }
                  setEditingThreshold(false);
                }}
                className="text-xs text-[#1edc6a] font-medium cursor-pointer px-2"
              >
                Save
              </button>
              <button onClick={() => setEditingThreshold(false)} className="text-xs text-slate-500 cursor-pointer px-1">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingThreshold(true)}
              className="text-xs text-slate-500 hover:text-[#1edc6a] transition-colors cursor-pointer w-full text-left"
            >
              Threshold: {product.alertThreshold != null ? `${currency} ${formatPrice(product.alertThreshold)}` : 'not set'} · click to edit
            </button>
          )
        )}
      </div>
    </motion.div>
  );
};

interface ProductGroup {
  label: string;
  products: TrackedProduct[];
}

function groupBySearchQuery(products: TrackedProduct[]): ProductGroup[] {
  const map = new Map<string, TrackedProduct[]>();
  for (const p of products) {
    const key = p.searchQuery ?? 'Uncategorized';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  // Uncategorized always last
  const entries = Array.from(map.entries()).sort(([a], [b]) => {
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });
  return entries.map(([label, prods]) => ({ label, products: prods }));
}

export const Dashboard = () => {
  const { dashboard, deleteTrackedProduct, updateAlertSettings } = useTrackedProducts();

  const handleDelete = (id: number) => {
    deleteTrackedProduct.mutate(id, {
      onSuccess: () => toast.success('Stopped tracking product'),
      onError: () => toast.error('Failed to delete'),
    });
  };

  const handleToggleAlert = (id: number, enabled: boolean, threshold?: number | null) => {
    updateAlertSettings.mutate(
      { id, data: { alertEnabled: enabled, alertThreshold: threshold ?? undefined } },
      {
        onSuccess: () => toast.success(enabled ? 'Alert enabled' : 'Alert disabled'),
        onError: () => toast.error('Failed to update alert'),
      },
    );
  };

  const products = useMemo(() => dashboard.data?.trackedProducts ?? [], [dashboard.data?.trackedProducts]);
  const groups = useMemo(() => groupBySearchQuery(products), [products]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] py-10">
      <div className="container mx-auto px-4 sm:px-6 md:px-8 lg:px-16">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Dashboard</h1>
              <p className="text-slate-400 text-sm mt-1">
                {products.length} tracked product{products.length !== 1 ? 's' : ''} · prices re-checked every 3 days
              </p>
            </div>
            <Link to="/">
              <Button variant="outline" size="sm">+ Track more</Button>
            </Link>
          </div>

          {dashboard.isLoading ? (
            <div className="text-slate-400 text-center py-20">Loading…</div>
          ) : products.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-24 border border-dashed border-[#262626] rounded-xl"
            >
              <Package className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400 font-medium mb-2">No tracked products yet</p>
              <p className="text-slate-600 text-sm mb-6">
                Click <strong>Track</strong> on any product in search results to start monitoring its price.
              </p>
              <Link to="/">
                <Button size="sm">Search Products</Button>
              </Link>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-10">
              {groups.map((group, gi) => (
                <motion.section
                  key={group.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.05 }}
                >
                  <h2 className="text-base font-semibold text-slate-300 mb-4 pb-2 border-b border-[#1a1a1a] line-clamp-1">
                    {group.label}
                    <span className="ml-2 text-xs font-normal text-slate-600">
                      {group.products.length} product{group.products.length !== 1 ? 's' : ''}
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {group.products.map(product => (
                      <TrackedProductCard
                        key={product.id}
                        product={product}
                        onDelete={handleDelete}
                        onToggleAlert={handleToggleAlert}
                        isDeleting={deleteTrackedProduct.isPending}
                        isUpdating={updateAlertSettings.isPending}
                      />
                    ))}
                  </div>
                </motion.section>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
