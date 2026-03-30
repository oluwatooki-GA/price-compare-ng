import { motion } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { UnifiedSearch } from '../components/search/UnifiedSearch';

export const Home = () => {

  return (
      <div className="min-h-screen bg-[#0A0A0A] text-white">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-16 sm:pb-24 md:pb-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-16 relative z-10">
            <motion.div
                className="max-w-3xl"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
            >
              <motion.h1
                  className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.1] mb-6 tracking-tight"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
              >
                Smartest way to <br/><span className="text-[#1edc6a]">shop in Nigeria.</span>
              </motion.h1>
              <motion.p
                  className="text-base sm:text-lg md:text-xl text-slate-400 mb-8 sm:mb-12 leading-relaxed max-w-2xl"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
              >
                Instantly compare prices across Jumia, Konga and Jiji. Save money with every click. No more switching tabs-get the best deals in seconds.
              </motion.p>
            </motion.div>

            {/* Action Hub */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="w-full"
            >
              <UnifiedSearch />
            </motion.div>

          </div>

          {/* Background Decoration */}
          <motion.div
              className="absolute top-0 right-0 -z-10 w-1/2 h-full bg-gradient-to-l from-[#1edc6a]/5 to-transparent blur-3xl"
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.3, 0.5, 0.3]
              }}
              transition={{
                duration: 8,
                repeat: Infinity,
                ease: "easeInOut"
              }}
          />
          <motion.div
              className="absolute bottom-0 left-0 -z-10 w-1/3 h-1/2 bg-gradient-to-tr from-[#1edc6a]/10 to-transparent blur-3xl opacity-50"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.6, 0.3]
              }}
              transition={{
                duration: 10,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 1
              }}
          />
        </section>

        {/* Features Section */}
        <section className="py-16 sm:py-20 md:py-24 bg-[#0A0A0A] border-y border-[#262626]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-16">
            <motion.div
                className="flex flex-col items-center text-center mb-12 sm:mb-16"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
            >
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-black mb-4">
                Engineered for <span className="text-[#1edc6a]">Savings</span>
              </h2>
              <p className="text-slate-400 max-w-2xl text-sm sm:text-base md:text-lg px-4">
                PriceCompare NG helps you navigate the Nigerian e-commerce landscape with precision-engineered data tools.
              </p>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8 max-w-4xl mx-auto">
              {[
                { icon: '⇄', title: 'Price Comparison', desc: 'See live prices from top retailers side-by-side to find the absolute best deal available in real-time.' },
                { icon: '★', title: 'Rating Analysis', desc: 'Aggregated reviews from multiple sources across the Nigerian web to ensure product quality and vendor trust.' }
              ].map((feature, index) => (
                  <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      whileHover={{ y: -5 }}
                  >
                    <Card className="h-full hover:border-[#1edc6a]/50 transition-all group">
                      <CardContent className="p-10">
                        <motion.div
                            className="size-14 rounded-xl bg-[#1edc6a]/10 flex items-center justify-center text-[#1edc6a] mb-8 group-hover:brightness-110 transition-all cursor-pointer"
                            whileHover={{ rotate: 360 }}
                            transition={{ duration: 0.6 }}
                        >
                          <span className="text-3xl">{feature.icon}</span>
                        </motion.div>
                        <h3 className="text-xl font-bold mb-4 text-white">{feature.title}</h3>
                        <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 sm:py-20 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-16">
            <motion.div
                className="relative bg-[#1edc6a] rounded-[1rem] sm:rounded-[2rem] p-6 sm:p-8 md:p-12 overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
            >
              <div className="relative z-10 max-w-xl text-center md:text-left">
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-[#0A0A0A] mb-4 sm:mb-6">Never overpay again.</h2>
                <p className="text-[#0A0A0A]/80 text-sm sm:text-base md:text-lg font-medium mb-6 sm:mb-10">
                  Join over 50,000 shoppers saving an average of ₦15,000 monthly using our smart comparison tools.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                  <motion.div whileTap={{ y: 1 }}>
                    <Button
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        size="lg"
                        className="bg-[#0A0A0A] text-white hover:bg-[#161616] border-2 border-[#0A0A0A] cursor-pointer"
                    >
                      <span>🛒</span>
                      Start Comparing Now
                    </Button>
                  </motion.div>
                </div>
              </div>
              <motion.div
                  className="mt-12 md:mt-0 relative h-64 w-64 md:h-80 md:w-80 bg-[#0A0A0A]/10 rounded-full flex items-center justify-center"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              >
                <span className="text-[10rem] text-[#0A0A0A]/20">📊</span>
              </motion.div>
              <motion.div
                  className="absolute -right-20 -top-20 size-80 bg-white/10 rounded-full blur-3xl"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 5, repeat: Infinity }}
              />
            </motion.div>
          </div>
        </section>
      </div>
  );
};
