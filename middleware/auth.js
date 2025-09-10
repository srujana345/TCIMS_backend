const jwt = require("jsonwebtoken");

// ✅ Check if user is logged in (has valid token)
function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"]; // "Bearer <token>"
  const token = authHeader && authHeader.split(" ")[1]; 
  if (!token) return res.status(401).json({ message: "No token provided" });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Invalid token" });
    req.user = user; // attach user info { userId, role }
    next(); // move on
  });
}

// ✅ Check if user role matches allowed roles
function authorize(roles = []) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
