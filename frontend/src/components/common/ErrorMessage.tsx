import { Button } from './Button';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage = ({ message, onRetry }: ErrorMessageProps) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-6">
      <div className="text-red-400 text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <p className="text-lg font-medium">{message}</p>
      </div>
      {onRetry && (
        <Button onClick={onRetry} variant="primary">
          Try Again
        </Button>
      )}
    </div>
  );
};
