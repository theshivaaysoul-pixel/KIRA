/**
 * Server entry point.
 * Starts the HTTP server on the configured PORT.
 */

const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`[Server] KIRA backend running on http://localhost:${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
});
