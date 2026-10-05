/**
 * KIRA Backend — Express Application Entry Point
 *
 * Initializes:
 *  - Environment variables (dotenv)
 *  - Firebase Admin SDK
 *  - Express middleware (CORS, Helmet, Morgan, JSON parsing)
 *  - API routes
 *  - Centralized error handler
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const { initializeFirebase } = require('./config/firebase');
const storageRouter = require('./routes/storage');
const { errorHandler } = require('./middleware/errorHandler');

// Initialize Firebase Admin SDK (will throw if env vars are missing)
initializeFirebase();

const app = express();

// ─── Security Headers ────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., server-to-server, curl, Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed.`));
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/storage', storageRouter);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Centralized Error Handler ────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
