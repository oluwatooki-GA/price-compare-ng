import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Mail, Lock, LogIn, Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const Login = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const onSubmit = (data: LoginFormData) => {
    login.mutate(data, {
      onSuccess: () => {
        toast.success('Welcome back!', {
          duration: 3000,
          position: 'top-center',
        });
        navigate('/');
      },
      onError: (error: any) => {
        const message = error?.userMessage || error?.response?.data?.message || 'Invalid email or password';
        toast.error(message, {
          duration: 4000,
          position: 'top-center',
        });
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A] px-8 md:px-12">
      <motion.div
        className="max-w-md w-full"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Card>
          <CardHeader className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <CardTitle className="text-3xl">Welcome back</CardTitle>
              <CardDescription className="mt-2">Sign in to your account</CardDescription>
            </motion.div>
          </CardHeader>
          <CardContent>
            <motion.form
              className="space-y-6"
              onSubmit={handleSubmit(onSubmit)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    {...register('email')}
                    type="email"
                    className="w-full pl-10 pr-4 py-3 bg-[#0A0A0A]/50 border border-[#262626] rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1edc6a] focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>
                {errors.email && (
                  <motion.p
                    className="mt-2 text-sm text-red-400"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    {errors.email.message}
                  </motion.p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    {...register('password')}
                    type="password"
                    className="w-full pl-10 pr-4 py-3 bg-[#0A0A0A]/50 border border-[#262626] rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#1edc6a] focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>
                {errors.password && (
                  <motion.p
                    className="mt-2 text-sm text-red-400"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    {errors.password.message}
                  </motion.p>
                )}
              </div>

              <motion.div whileTap={{ y: 1 }}>
                <Button
                  type="submit"
                  disabled={login.isPending}
                  size="lg"
                  className="w-full cursor-pointer gap-2"
                >
                  {login.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      Sign in
                    </>
                  )}
                </Button>
              </motion.div>

              <div className="text-center text-sm">
                <span className="text-slate-400">Don't have an account? </span>
                <Link to="/register" className="text-[#1edc6a] hover:brightness-110 font-medium">
                  Sign up
                </Link>
              </div>
            </motion.form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
