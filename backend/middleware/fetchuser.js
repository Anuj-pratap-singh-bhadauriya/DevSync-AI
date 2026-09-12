const jwt = require('jsonwebtoken');

const fetchuser = (req, res, next) => {
  // 1. Extract token — support both custom header and standard Bearer format
  let token = req.header('auth-token');
  if (!token) {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }
  }

  // 2. Validate token presence
  if (!token) {
    return res.status(401).json({ error: "Access denied. Valid authentication token required." });
  }

  try {
    // 3. Verify cryptographic signature and expiry
    const decodedPayload = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Attach only the userId — downstream code only needs this
    req.user = { userId: decodedPayload.userId };

    // 5. Transfer execution control to the protected route handler
    next();
  } catch (error) {
    // 6. Differentiate expired vs invalid/malformed token
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }
    return res.status(401).json({ error: "Invalid or malformed authentication token." });
  }
};

module.exports = fetchuser;