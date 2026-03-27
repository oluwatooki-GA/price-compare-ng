import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Search, Bookmark, LogIn, UserPlus } from 'lucide-react';

export const Header = () => {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 h-16 sm:h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
          <img src="/logo.svg" alt="PriceCompare NG" className="size-8 sm:size-10" />
          <span className="text-base sm:text-xl font-extrabold tracking-tight text-white group-hover:text-[#1edc6a] transition-colors">
            PriceCompare <span className="text-[#1edc6a]">NG</span>
          </span>
        </Link>

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

        <div className="flex items-center gap-2 sm:gap-3">
          {isAuthenticated ? (
            <>
              <span className="text-xs sm:text-sm text-slate-400 hidden sm:block">{user.data?.email}</span>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm bg-[#161616] text-white rounded-lg hover:bg-[#262626] transition-colors border border-[#262626]"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 text-xs sm:text-sm text-white hover:text-[#1edc6a] transition-colors"
              >
                <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Login</span>
              </Link>
              <Link
                to="/register"
                className="flex items-center gap-1.5 sm:gap-2 bg-[#1edc6a] text-[#0A0A0A] px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold hover:brightness-110 transition-all"
              >
                <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline sm:inline">Get Started</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
