import { useState, useRef, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { useSearch } from '../../hooks/useSearch';
import { useNavigate } from 'react-router-dom';

interface PrefillData {
    name: string;
    price: number;
    rating: number | null;
    platform: string;
}

type Step = 'paste' | 'prefilled' | 'loading';

// ── Dual-handle range slider ──────────────────────────────────────────────────

interface RangeSliderProps {
    min: number;
    max: number;
    low: number;
    high: number;
    onChange: (low: number, high: number) => void;
}

const RangeSlider = ({ min, max, low, high, onChange }: RangeSliderProps) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const activeHandle = useRef<'low' | 'high' | null>(null);
    const startValues = useRef({ low, high, x: 0 });

    const pct = (v: number) => ((v - min) / (max - min)) * 100;
    const lowPct = pct(low);
    const highPct = pct(high);

    const handleMouseDown = (handle: 'low' | 'high') => (e: ReactMouseEvent<HTMLDivElement>) => {
        activeHandle.current = handle;
        isDragging.current = true;
        startValues.current = { low, high, x: e.clientX };
        e.preventDefault();
        e.stopPropagation();
    };

    const handleTrackClick = (e: ReactMouseEvent<HTMLDivElement>) => {
        if (!trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clickPct = x / rect.width;
        const value = Math.round(min + clickPct * (max - min));

        // Move the closer handle
        if (clickPct < (lowPct + highPct) / 200) {
            onChange(Math.min(value, high - 1), high);
        } else {
            onChange(low, Math.max(value, low + 1));
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: globalThis.MouseEvent) => {
            if (!isDragging.current || !trackRef.current) return;

            const rect = trackRef.current.getBoundingClientRect();
            const deltaX = e.clientX - startValues.current.x;
            const deltaValue = Math.round((deltaX / rect.width) * (max - min));

            if (activeHandle.current === 'low') {
                const newLow = Math.max(min, Math.min(high - 1, startValues.current.low + deltaValue));
                onChange(newLow, high);
            } else {
                const newHigh = Math.min(max, Math.max(low + 1, startValues.current.high + deltaValue));
                onChange(low, newHigh);
            }
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            activeHandle.current = null;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [low, high, min, max, onChange]);

    return (
        <div ref={trackRef} className="relative w-full py-5" onMouseDown={handleTrackClick}>
            {/* Background track */}
            <div className="absolute top-1/2 left-0 right-0 h-2.5 -translate-y-1/2 rounded-full bg-[#262626]" />

            {/* Active range */}
            <div
                className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-[#1edc6a]"
                style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
            />

            {/* Low handle */}
            <div
                onMouseDown={handleMouseDown('low')}
                className="absolute top-1/2 w-6 h-6 -translate-y-1/2 rounded-full bg-[#1edc6a] shadow-lg touch-none"
                style={{ left: `calc(${lowPct}% - 12px)` }}
            />

            {/* High handle */}
            <div
                onMouseDown={handleMouseDown('high')}
                className="absolute top-1/2 w-6 h-6 -translate-y-1/2 rounded-full bg-[#1edc6a] shadow-lg touch-none"
                style={{ left: `calc(${highPct}% - 12px)` }}
            />
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────

export const UrlPrefillForm = () => {
    const { searchByUrl, searchByKeyword } = useSearch();
    const navigate = useNavigate();

    const [step, setStep]       = useState<Step>('paste');
    const [url, setUrl]         = useState('');
    const [urlError, setUrlError] = useState('');
    const [prefill, setPrefill] = useState<PrefillData | null>(null);

    const [editedName,   setEditedName]   = useState('');
    const [editedRating, setEditedRating] = useState('');

    // Slider state — absolute NGN values
    const [sliderMin,  setSliderMin]  = useState(0);   // track bounds
    const [sliderMax,  setSliderMax]  = useState(0);
    const [rangeLow,   setRangeLow]   = useState(0);   // current handles
    const [rangeHigh,  setRangeHigh]  = useState(0);

    const handleRangeChange = (low: number, high: number) => {
        setRangeLow(low);
        setRangeHigh(high);
    };

    const handleScrapeUrl = (e: React.FormEvent) => {
        e.preventDefault();
        setUrlError('');
        try { new URL(url); } catch {
            setUrlError('Please enter a valid URL');
            return;
        }

        setStep('loading');

        searchByUrl.mutate(
            { url },
            {
                onSuccess: (data) => {
                    let product: any = null;
                    if (data && typeof data === 'object') {
                        if (Array.isArray(data))                    product = (data as any[])[0]?.products?.[0];
                        else if ('results' in (data as any))        product = (data as any).results?.[0]?.products?.[0];
                        else if ('products' in (data as any))       product = (data as any).products?.[0];
                    }

                    if (!product?.name) {
                        setUrlError('Could not extract product data from that URL');
                        setStep('paste');
                        return;
                    }

                    const scraped: PrefillData = {
                        name:     product.name ?? '',
                        price:    product.price ?? 0,
                        rating:   product.rating ?? null,
                        platform: product.platform ?? '',
                    };

                    setPrefill(scraped);
                    setEditedName(scraped.name);
                    setEditedRating(scraped.rating ? String(scraped.rating) : '');

                    // Set slider bounds to ±50% of scraped price, handles at ±20%
                    const base   = scraped.price;
                    const sMin   = Math.round(base * 0.5);
                    const sMax   = Math.round(base * 1.5);
                    const hLow   = Math.round(base * 0.8);
                    const hHigh  = Math.round(base * 1.2);
                    setSliderMin(sMin);
                    setSliderMax(sMax);
                    setRangeLow(hLow);
                    setRangeHigh(hHigh);

                    setStep('prefilled');
                },
                onError: () => {
                    setUrlError("Failed to scrape that URL. Make sure it's a supported platform (Jumia or Jiji).");
                    setStep('paste');
                },
            }
        );
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editedName.trim()) return;

        searchByKeyword.mutate(
            {
                keyword:   editedName.trim(),
                minPrice:  rangeLow  > sliderMin ? rangeLow  : undefined,
                maxPrice:  rangeHigh < sliderMax ? rangeHigh : undefined,
                minRating: editedRating ? parseFloat(editedRating) : undefined,
                limit:     20,
            },
            {
                onSuccess: (data) => {
                    const q = editedName.trim();
                    const params = new URLSearchParams({ q });
                    if (rangeLow  > sliderMin) params.set('minPrice', String(rangeLow));
                    if (rangeHigh < sliderMax) params.set('maxPrice', String(rangeHigh));
                    if (editedRating)          params.set('minRating', editedRating);
                    navigate(`/search?${params.toString()}`, {
                        state: {
                            results: data,
                            query: q,
                            type: 'keyword',
                            originalPrice: prefill?.price ?? undefined,
                        },
                    });
                },
            }
        );
    };

    const isSearching = searchByKeyword.isPending;
    const isScraping  = searchByUrl.isPending || step === 'loading';

    return (
        <Card>
            <CardContent className="p-4 sm:p-6 md:p-10">
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 sm:mb-6 flex items-center gap-2">
                    <span className="text-sm sm:text-base">🔗</span>
                    Compare by Link
                </h3>

                <AnimatePresence mode="wait">

                    {/* ── Step 1: paste URL ── */}
                    {(step === 'paste' || step === 'loading') && (
                        <motion.form
                            key="paste"
                            onSubmit={handleScrapeUrl}
                            className="flex flex-col gap-4"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.25 }}
                        >
                            <div>
                                <input
                                    value={url}
                                    onChange={e => { setUrl(e.target.value); setUrlError(''); }}
                                    className="w-full h-14 sm:h-16 bg-[#0A0A0A]/50 border border-[#262626] focus:border-[#1edc6a] focus:ring-2 focus:ring-[#1edc6a] rounded-lg px-4 sm:px-6 text-base sm:text-lg text-white placeholder:text-slate-500 transition-all outline-none"
                                    placeholder="Paste Jumia or Jiji link…"
                                    type="text"
                                    disabled={isScraping}
                                />
                                {urlError && <p className="mt-1 text-xs sm:text-sm text-red-400">{urlError}</p>}
                            </div>

                            <motion.div whileTap={{ y: 1 }}>
                                <Button
                                    type="submit"
                                    disabled={isScraping || !url.trim()}
                                    variant="secondary"
                                    size="lg"
                                    className="w-full cursor-pointer"
                                >
                                    {isScraping
                                        ? <span className="flex items-center gap-2"><span className="animate-spin">⟳</span>Fetching product…</span>
                                        : 'Fetch & Prefill'}
                                </Button>
                            </motion.div>

                            <div className="flex justify-center gap-4 grayscale opacity-40 mt-1">
                                <span className="text-[10px] font-bold tracking-widest uppercase">Works with:</span>
                                {['Jumia', 'Jiji'].map(p => (
                                    <span key={p} className="text-[10px] font-black uppercase">{p}</span>
                                ))}
                            </div>
                        </motion.form>
                    )}

                    {/* ── Step 2: prefilled form ── */}
                    {step === 'prefilled' && prefill && (
                        <motion.form
                            key="prefilled"
                            onSubmit={handleSearch}
                            className="flex flex-col gap-5"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.25 }}
                        >
                            {/* Source badge */}
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="w-2 h-2 rounded-full bg-[#1edc6a] flex-shrink-0" />
                                Scraped from{' '}
                                <span className="capitalize font-semibold text-slate-400">{prefill.platform}</span>
                                <button
                                    type="button"
                                    onClick={() => setStep('paste')}
                                    className="ml-auto text-slate-500 hover:text-slate-300 underline text-xs"
                                >
                                    Use a different URL
                                </button>
                            </div>

                            {/* Product name */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
                                    Search for
                                </label>
                                <input
                                    value={editedName}
                                    onChange={e => setEditedName(e.target.value)}
                                    className="w-full h-12 sm:h-12 bg-[#0A0A0A]/50 border border-[#262626] focus:border-[#1edc6a] focus:ring-2 focus:ring-[#1edc6a] rounded-lg px-4 text-base text-white placeholder:text-slate-500 outline-none transition-all"
                                    placeholder="Product name"
                                />
                            </div>

                            {/* Price range slider */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                                        Price Range (₦)
                                    </label>
                                    <span className="text-xs text-slate-500">
                    Scraped: ₦{prefill.price.toLocaleString()}
                  </span>
                                </div>

                                <RangeSlider
                                    min={sliderMin}
                                    max={sliderMax}
                                    low={rangeLow}
                                    high={rangeHigh}
                                    onChange={handleRangeChange}
                                />

                                {/* Current values below slider */}
                                <div className="flex justify-between mt-1">
                  <span className="text-xs text-[#1edc6a] font-medium">
                    ₦{rangeLow.toLocaleString()}
                  </span>
                                    <span className="text-xs text-[#1edc6a] font-medium">
                    ₦{rangeHigh.toLocaleString()}
                  </span>
                                </div>

                                {/* Fine-tune inputs for keyboard editing */}
                                <div className="flex gap-2 mt-2">
                                    <input
                                        type="number"
                                        value={rangeLow}
                                        onChange={e => {
                                            const v = Number(e.target.value);
                                            if (!isNaN(v) && v >= sliderMin && v < rangeHigh) {
                                                setRangeLow(v);
                                            }
                                        }}
                                        onBlur={e => {
                                            if (e.target.value === '') setRangeLow(sliderMin);
                                        }}
                                        className="flex-1 h-9 bg-[#0A0A0A]/50 border border-[#262626] focus:border-[#1edc6a] rounded-lg px-3 text-sm text-white outline-none"
                                    />
                                    <span className="text-slate-600 self-center">–</span>
                                    <input
                                        type="number"
                                        value={rangeHigh}
                                        onChange={e => {
                                            const v = Number(e.target.value);
                                            if (!isNaN(v) && v <= sliderMax && v > rangeLow) {
                                                setRangeHigh(v);
                                            }
                                        }}
                                        onBlur={e => {
                                            if (e.target.value === '') setRangeHigh(sliderMax);
                                        }}
                                        className="flex-1 h-9 bg-[#0A0A0A]/50 border border-[#262626] focus:border-[#1edc6a] rounded-lg px-3 text-sm text-white outline-none"
                                    />
                                </div>
                            </div>

                            {/* Minimum rating */}
                            <div>
                                <label className="block text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">
                                    Minimum Rating
                                </label>
                                <select
                                    value={editedRating}
                                    onChange={e => setEditedRating(e.target.value)}
                                    className="w-full h-12 bg-[#0A0A0A]/50 border border-[#262626] focus:border-[#1edc6a] focus:ring-2 focus:ring-[#1edc6a] rounded-lg px-4 text-white outline-none transition-all"
                                >
                                    <option value="">Any rating</option>
                                    <option value="3">3+ Stars</option>
                                    <option value="4">4+ Stars</option>
                                    <option value="4.5">4.5+ Stars</option>
                                </select>
                                {prefill.rating && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        Scraped rating: {prefill.rating} ★
                                    </p>
                                )}
                            </div>

                            <motion.div whileTap={{ y: 1 }}>
                                <Button
                                    type="submit"
                                    disabled={isSearching || !editedName.trim()}
                                    size="lg"
                                    className="w-full cursor-pointer"
                                >
                                    {isSearching ? 'Searching…' : 'Find Similar Products'}
                                </Button>
                            </motion.div>
                        </motion.form>
                    )}

                </AnimatePresence>
            </CardContent>
        </Card>
    );
};
