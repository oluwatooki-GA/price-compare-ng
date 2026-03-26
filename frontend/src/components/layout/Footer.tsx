export const Footer = () => {
  return (
    <footer className="bg-[#161616] border-t border-[#262626] py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} PriceCompare NG. All rights reserved.</p>
          <p className="mt-2">Smartest way to shop in Nigeria</p>
        </div>
      </div>
    </footer>
  );
};
