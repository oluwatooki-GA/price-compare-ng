type ApiError = { response?: { data?: { message?: string } }; message?: string };

export const formatError = (error: unknown): string => {
  const defaultMessage = 'An error occurred. Please try again later.';

  if (!error) return defaultMessage;

  const err = error as ApiError;

  if (err.response?.data?.message) {
    const message = err.response.data.message;
    
    // Sanitize technical details
    const sanitized = message
      .replace(/database/gi, 'system')
      .replace(/sql/gi, '')
      .replace(/prisma/gi, '')
      .replace(/internal server error/gi, 'service error')
      .replace(/stack trace/gi, '')
      .replace(/\bat\s+.*/gi, ''); // Remove stack traces
    
    return sanitized || defaultMessage;
  }

  if (err.message) {
    if (err.message.includes('Network Error')) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }
    
    if (err.message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    
    return defaultMessage;
  }

  return defaultMessage;
};
