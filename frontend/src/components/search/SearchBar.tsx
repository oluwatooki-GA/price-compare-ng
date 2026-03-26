import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../common/Button';
import { Search as SearchIcon, Loader2 } from 'lucide-react';

const keywordSchema = z.object({
  query: z.string().min(2, 'Search query must be at least 2 characters'),
});

const urlSchema = z.object({
  query: z.string().url('Please enter a valid URL'),
});

type SearchFormData = z.infer<typeof keywordSchema>;

interface SearchBarProps {
  searchType: 'keyword' | 'url';
  onSearch: (query: string) => void;
  isLoading?: boolean;
}

export const SearchBar = ({ searchType, onSearch, isLoading }: SearchBarProps) => {
  const schema = searchType === 'keyword' ? keywordSchema : urlSchema;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SearchFormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: SearchFormData) => {
    onSearch(data.query);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-2xl">
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            {...register('query')}
            type="text"
            placeholder={
              searchType === 'keyword'
                ? 'Search for products...'
                : 'Paste product URL...'
            }
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {errors.query && (
            <p className="mt-1 text-sm text-red-600">{errors.query.message}</p>
          )}
        </div>
        <Button type="submit" isLoading={isLoading} className="px-8 gap-2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <SearchIcon className="w-4 h-4" />
          )}
          <span>Search</span>
        </Button>
      </div>
    </form>
  );
};