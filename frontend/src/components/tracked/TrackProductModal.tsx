import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, BellOff } from 'lucide-react';
import { Button } from '../ui/button';
import type { ProductData } from '../../types';

interface TrackProductModalProps {
  product: ProductData;
  onConfirm: (alertThreshold?: number, alertEnabled?: boolean) => void;
  onClose: () => void;
  isPending: boolean;
}

export const TrackProductModal = ({ product, onConfirm, onClose, isPending }: TrackProductModalProps) => {
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [threshold, setThreshold] = useState<string>(
    product.price ? String(Math.floor(product.price * 0.9)) : ''
  );

  const handleConfirm = () => {
    const parsedThreshold = alertEnabled && threshold ? parseFloat(threshold) : undefined;
    onConfirm(parsedThreshold, alertEnabled);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md bg-[#161616] border border-[#262626] rounded-xl p-6 shadow-2xl"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <h2 className="text-lg font-bold text-white mb-1">Track this product</h2>
          <p className="text-sm text-slate-400 mb-4 line-clamp-2">{product.name}</p>

          <div className="flex items-center justify-between p-3 bg-[#0A0A0A] rounded-lg mb-4">
            <span className="text-sm text-slate-400">Current price</span>
            <span className="text-lg font-bold text-white">
              {product.currency} {product.price.toLocaleString()}
            </span>
          </div>

          <div className="mb-5">
            <button
              onClick={() => setAlertEnabled(prev => !prev)}
              className={`flex items-center gap-3 w-full p-3 rounded-lg border transition-all cursor-pointer ${
                alertEnabled
                  ? 'border-[#1edc6a] bg-[#1edc6a]/10 text-white'
                  : 'border-[#262626] bg-[#0A0A0A] text-slate-400 hover:border-[#333]'
              }`}
            >
              {alertEnabled ? <Bell className="w-4 h-4 text-[#1edc6a]" /> : <BellOff className="w-4 h-4" />}
              <span className="text-sm font-medium">
                {alertEnabled ? 'Alert enabled' : 'Enable price alert'}
              </span>
            </button>

            <AnimatePresence>
              {alertEnabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3">
                    <label className="block text-xs text-slate-400 mb-1.5">
                      Alert me when price drops below ({product.currency})
                    </label>
                    <input
                      type="number"
                      value={threshold}
                      onChange={e => setThreshold(e.target.value)}
                      placeholder={`e.g. ${Math.floor(product.price * 0.9).toLocaleString()}`}
                      className="w-full bg-[#0A0A0A] border border-[#262626] focus:border-[#1edc6a] rounded-lg px-3 py-2 text-white text-sm outline-none transition-colors"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose} className="flex-1 text-slate-400">
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isPending || (alertEnabled && !threshold)}
              className="flex-1 bg-[#1edc6a] text-[#0A0A0A] hover:brightness-110"
            >
              {isPending ? 'Tracking…' : 'Track Product'}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
