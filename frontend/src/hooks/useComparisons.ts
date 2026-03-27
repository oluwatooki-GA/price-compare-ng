import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { comparisonsApi } from '../api/comparisons';
import type { SaveComparisonRequest } from '../api/comparisons';

export const useComparisons = () => {
  const queryClient = useQueryClient();

  const saveComparison = useMutation({
    mutationFn: (data: SaveComparisonRequest) => comparisonsApi.saveComparison(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comparisons'] });
    },
  });

  const comparisons = useQuery({
    queryKey: ['comparisons'],
    queryFn: comparisonsApi.getUserComparisons,
    enabled: !!localStorage.getItem('token'),
    staleTime: 1 * 60 * 1000, // 1 minute for saved comparisons
  });

  const deleteComparison = useMutation({
    mutationFn: (id: number) => comparisonsApi.deleteComparison(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comparisons'] });
    },
  });

  return {
    saveComparison,
    comparisons,
    deleteComparison,
  };
};
