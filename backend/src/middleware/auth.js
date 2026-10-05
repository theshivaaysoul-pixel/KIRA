/**
 * Firebase Auth middleware
 *
 * Verifies the Firebase ID token sent in the Authorization header.
 * Attaches the decoded token to req.user.
 *
 * Usage:
 *   router.use(requireAuth);
 *   or on individual routes:
 *   router.get('/protected', requireAuth, handler);
 *
 * The frontend sends:
 *   Authorization: Bearer <Firebase ID Token>
 */

const { getAuth } = require('../config/firebase');

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: missing or invalid Authorization header.',
    });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    req.user = decodedToken; // { uid, email, name, ... }
    next();
  } catch (err) {
    console.error('[Auth] Token verification failed:', err.message);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: invalid or expired token.',
    });
  }
}

module.exports = { requireAuth };
