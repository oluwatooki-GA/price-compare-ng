import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { SearchResults } from './pages/SearchResults';
import { SavedComparisons } from './pages/SavedComparisons';
import { Toaster } from 'react-hot-toast';

// inside your root return:

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/search" element={<SearchResults />} />
          <Route
            path="/saved"
            element={
              <ProtectedRoute>
                <SavedComparisons />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Layout>
      <Toaster
  position="bottom-right"
  toastOptions={{
    style: {
      background: '#161616',
      color: '#fff',
      border: '1px solid #262626',
    },
    success: { iconTheme: { primary: '#1edc6a', secondary: '#0A0A0A' } },
  }}
/>
    </BrowserRouter>
  );
}

export default App;
