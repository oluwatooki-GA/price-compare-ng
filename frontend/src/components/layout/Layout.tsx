import { Header } from './Header';
import { Footer } from './Footer';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen flex flex-col bg-[#0A0A0A] overflow-x-hidden">
      <Header />
      <main className="flex-1 pt-16 sm:pt-20 w-full">{children}</main>
      <Footer />
    </div>
  );
};
