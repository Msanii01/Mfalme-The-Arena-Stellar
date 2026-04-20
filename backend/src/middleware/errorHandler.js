/**
 * Central error handler — must be last middleware registered in Express.
 */
export function errorHandler(err, req, res, next) {  // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Log full error in development
  if (process.env.NODE_ENV !== 'production') {
    console.error(`❌ ${req.method} ${req.path} → ${status}: ${message}`);
    if (err.stack) console.error(err.stack);
  } else {
    // In production only log 5xx errors
    if (status >= 500) {
      console.error(`❌ ${req.method} ${req.path} → ${status}: ${message}`);
    }
  }

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}

/**
 * Convenience: create an HTTP error with a status code.
 */
export function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
