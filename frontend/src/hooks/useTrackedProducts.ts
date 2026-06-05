import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { trackedProductsApi } from '../api/trackedProducts';
import type { TrackProductRequest, UpdateAlertSettingsRequest } from '../api/trackedProducts';

export const useTrackedProducts = () => {
  const queryClient = useQueryClient();

  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: trackedProductsApi.getDashboard,
    enabled: !!localStorage.getItem('token'),
    staleTime: 2 * 60 * 1000,
  });

  const trackProduct = useMutation({
    mutationFn: (data: TrackProductRequest) => trackedProductsApi.trackProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const updateAlertSettings = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateAlertSettingsRequest }) =>
      trackedProductsApi.updateAlertSettings(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deleteTrackedProduct = useMutation({
    mutationFn: (id: number) => trackedProductsApi.deleteTrackedProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  return {
    dashboard,
    trackProduct,
    updateAlertSettings,
    deleteTrackedProduct,
  };
};
