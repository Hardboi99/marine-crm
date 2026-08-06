/**
 * Global error handler middleware (must be last app.use() in app.js)
 * Catches all errors thrown via next(err) or unhandled throws in async routes
 */
const errorHandler = (err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err);

  // Mongoose duplicate key error (code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    return res.status(409).json({
      success: false,
      message: `A record with this ${field || 'value'} already exists.`,
      field: field,
    });
  }

  // Mongoose CastError (invalid ObjectId format)
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: `Invalid ID format: ${err.value}` });
  }

  // Mongoose ValidationError
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ success: false, message: 'Validation Error', errors });
  }

  // Mongoose connection buffering timeout
  if (err.name === 'MongooseError' && err.message.includes('buffering timed out')) {
    return res.status(503).json({
      success: false,
      message: 'Database connection failed or pending. Please verify your MongoDB Atlas password in server/.env and ensure Network Access (IP Whitelist) allows your connection.',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }

  // Validation errors (from express-validator)
  if (err.type === 'validation') {
    return res.status(400).json({ success: false, message: err.message, errors: err.errors });
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large. Maximum allowed size exceeded.' });
  }

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { errorHandler };
