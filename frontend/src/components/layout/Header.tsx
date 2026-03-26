import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export const Header = () => {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-8 bg-[#1edc6a] rounded-lg flex items-center justify-center text-[#0A0A0A]">
            <span className="font-bold">💰</span>
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white uppercase">
            PriceCompare <span className="text-[#1edc6a]">NG</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-10">
          <Link to="/" className="text-sm font-medium text-white hover:text-[#1edc6a] transition-colors">
            Home
          </Link>
          {isAuthenticated && (
            <Link to="/saved" className="text-sm font-medium text-white hover:text-[#1edc6a] transition-colors">
              Saved
            </Link>
          )}
        </div>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-slate-400 hidden sm:block">{user.data?.email}</span>
              <button
                onClick={logout}
                className="px-4 py-2 text-sm bg-[#161616] text-white rounded-lg hover:bg-[#262626] transition-colors border border-[#262626]"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-2 text-sm text-white hover:text-[#1edc6a] transition-colors"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="bg-[#1edc6a] text-[#0A0A0A] px-6 py-2.5 rounded-lg text-sm font-bold hover:brightness-110 transition-all"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
