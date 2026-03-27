import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Search, Bookmark, LogIn, UserPlus, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Header = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 h-16 sm:h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 sm:gap-3 group" onClick={() => setMobileMenuOpen(false)}>
          <img src="/logo.svg" alt="PriceCompare NG" className="size-8 sm:size-10" />
          <span className="text-base sm:text-xl font-extrabold tracking-tight text-white group-hover:text-[#1edc6a] transition-colors">
            PriceCompare <span className="text-[#1edc6a]">NG</span>
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-10">
          <Link to="/" className="flex items-center gap-2 text-sm font-medium text-white hover:text-[#1edc6a] transition-colors">
            <Search className="w-4 h-4" />
            Home
          </Link>
          {isAuthenticated && (
            <Link to="/saved" className="flex items-center gap-2 text-sm font-medium text-white hover:text-[#1edc6a] transition-colors">
              <Bookmark className="w-4 h-4" />
              Saved
            </Link>
          )}
        </div>

        {/* Desktop Auth Buttons */}
        <div className="hidden md:flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-slate-400">{user.data?.email}</span>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-[#161616] text-white rounded-lg hover:bg-[#262626] transition-colors border border-[#262626]"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="flex items-center gap-2 px-4 py-2 text-sm text-white hover:text-[#1edc6a] transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Login
              </Link>
              <Link
                to="/register"
                className="flex items-center gap-2 bg-[#1edc6a] text-[#0A0A0A] px-6 py-2.5 rounded-lg text-sm font-bold hover:brightness-110 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <motion.button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-white hover:text-[#1edc6a] transition-colors"
          aria-label="Toggle menu"
          whileTap={{ scale: 0.95 }}
          animate={{ rotate: mobileMenuOpen ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <Menu className="w-6 h-6" />
        </motion.button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden border-t border-[#262626] bg-[#0A0A0A] overflow-hidden"
          >
            <motion.div
              initial={{ y: -20 }}
              animate={{ y: 0 }}
              exit={{ y: -20 }}
              transition={{ duration: 0.2 }}
              className="px-4 py-4 space-y-3"
            >
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Link
                  to="/"
                  className="flex items-center gap-3 px-4 py-3 text-white hover:bg-[#161616] rounded-lg transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Search className="w-5 h-5" />
                  Home
                </Link>
              </motion.div>
              {isAuthenticated && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  <Link
                    to="/saved"
                    className="flex items-center gap-3 px-4 py-3 text-white hover:bg-[#161616] rounded-lg transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Bookmark className="w-5 h-5" />
                    Saved Comparisons
                  </Link>
                </motion.div>
              )}
              <div className="border-t border-[#262626] pt-3 mt-3">
                {isAuthenticated ? (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <div className="px-4 py-2 text-sm text-slate-400">{user.data?.email}</div>
                    <button
                      onClick={() => { logout(); setMobileMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-white hover:bg-[#161616] rounded-lg transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                      Logout
                    </button>
                  </motion.div>
                ) : (
                  <>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <Link
                        to="/login"
                        className="flex items-center gap-3 px-4 py-3 text-white hover:bg-[#161616] rounded-lg transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <LogIn className="w-5 h-5" />
                        Login
                      </Link>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 }}
                    >
                      <Link
                        to="/register"
                        className="flex items-center gap-3 px-4 py-3 bg-[#1edc6a] text-[#0A0A0A] rounded-lg font-bold hover:brightness-110 transition-colors"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <UserPlus className="w-5 h-5" />
                        Get Started
                      </Link>
                    </motion.div>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
