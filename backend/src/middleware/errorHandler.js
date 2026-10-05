/**
 * Error handler middleware
 *
 * Catches errors from route handlers and returns clean JSON responses.
 * Never exposes internal GCS credentials or stack traces to the client.
 */

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';

  // Log the full error server-side for debugging
  console.error(`[Error] ${code}: ${err.message}`, {
    status,
    path: req.path,
    method: req.method,
    userId: req.user?.uid,
  });

  // Never expose internal details to the client
  const clientMessage =
    status < 500
      ? err.message
      : 'An internal server error occurred. Please try again later.';

  res.status(status).json({
    success: false,
    error: {
      code,
      message: clientMessage,
    },
  });
}

module.exports = { errorHandler };
