export const formatError = (error: any): string => {
  // Default user-friendly message
  const defaultMessage = 'An error occurred. Please try again later.';

  // If no error object, return default
  if (!error) return defaultMessage;

  // If error has a response from the API
  if (error.response?.data?.message) {
    const message = error.response.data.message;
    
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

  // If error has a message property
  if (error.message) {
    // Don't expose network errors in detail
    if (error.message.includes('Network Error')) {
      return 'Unable to connect to the server. Please check your internet connection.';
    }
    
    if (error.message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    
    return defaultMessage;
  }

  return defaultMessage;
};
