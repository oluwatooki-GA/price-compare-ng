interface SearchTypeToggleProps {
  searchType: 'keyword' | 'url';
  onToggle: (type: 'keyword' | 'url') => void;
}

export const SearchTypeToggle = ({ searchType, onToggle }: SearchTypeToggleProps) => {
  return (
    <div className="flex gap-2 mb-4">
      <button
        type="button"
        onClick={() => onToggle('keyword')}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          searchType === 'keyword'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        Keyword Search
      </button>
      <button
        type="button"
        onClick={() => onToggle('url')}
        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
          searchType === 'url'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        URL Search
      </button>
    </div>
  );
};
