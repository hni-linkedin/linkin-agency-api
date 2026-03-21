/**
 * CORS: comma-separated origins in CORS_ORIGINS (e.g. local + Vercel).
 * Example: CORS_ORIGINS=http://localhost:3000,https://linkin-agency-dashboard.vercel.app
 */
function getAllowedOrigins() {
  const raw = process.env.CORS_ORIGINS || 'http://localhost:3000';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Headers browsers may send on preflight (incl. global API key interceptor). */
const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'x-api-key',
  'X-API-Key',
];

function createCorsOptions() {
  const allowedOrigins = getAllowedOrigins();

  return {
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ALLOWED_HEADERS,
  };
}

module.exports = {
  getAllowedOrigins,
  ALLOWED_HEADERS,
  createCorsOptions,
};
