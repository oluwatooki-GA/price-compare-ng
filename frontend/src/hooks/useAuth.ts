import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import type { RegisterRequest, LoginRequest } from '../api/auth';

export const useAuth = () => {
  const queryClient = useQueryClient();

  const login = useMutation({
    mutationFn: (credentials: LoginRequest) => authApi.login(credentials),
    onSuccess: (data) => {
      localStorage.setItem('token', data.accessToken);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  const register = useMutation({
    mutationFn: (data: RegisterRequest) => authApi.register(data),
    onSuccess: (data) => {
      localStorage.setItem('token', data.accessToken);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });

  const user = useQuery({
    queryKey: ['user'],
    queryFn: authApi.getCurrentUser,
    enabled: !!localStorage.getItem('token'),
    retry: false,
    staleTime: 10 * 60 * 1000, // 10 minutes for user data
  });

  const logout = () => {
    localStorage.removeItem('token');
    queryClient.setQueryData(['user'], null);
    window.location.href = '/login';
  };

  return {
    login,
    register,
    user,
    logout,
    isAuthenticated: !!user.data,
    isLoading: user.isLoading,
  };
};
