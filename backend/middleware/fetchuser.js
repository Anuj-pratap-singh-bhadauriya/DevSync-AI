const jwt = require('jsonwebtoken');

const fetchuser = (req, res, next) => {
  // 1. Extract the authorization token from the request headers
  const token = req.header('auth-token');
  
  // 2. Validate token presence
  if (!token) {
    return res.status(401).json({ error: "Access denied. Valid authentication token required." });
  }

  try {
    // 3. Verify cryptographic signature of the token
    const decodedPayload = jwt.verify(token, process.env.JWT_SECRET);
    
    // 4. Attach the decoded token payload directly to the request object
    // This perfectly aligns with the { userId: ... } payload generated in server.js
    req.user = decodedPayload;
    
    // 5. Transfer execution control to the protected route handler
    next();
  } catch (error) {
    console.error("Token Verification Error:", error.message);
    res.status(401).json({ error: "Invalid or expired authorization token." });
  }
};

module.exports = fetchuser;