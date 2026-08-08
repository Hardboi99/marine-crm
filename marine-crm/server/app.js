const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const { errorHandler } = require('./middlewares/errorHandler');

// BDM Routes
const authRoutes = require('./routes/auth');
const bdmRoutes = require('./routes/bdm');
const pipelineRoutes = require('./routes/pipeline');
const dashboardRoutes = require('./routes/dashboard');
const crewingRoutes = require('./routes/crewing');
const opsRoutes = require('./routes/ops');
const employeeRoutes = require('./routes/employees');
const receptionRoutes = require('./routes/reception');

const app = express();

// Security headers — CSP configured to allow CDN scripts, FontAwesome, inline script attributes, and media
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://cdn.jsdelivr.net",
        "https://cdnjs.cloudflare.com",
      ],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com",
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com",
      ],
      imgSrc: ["'self'", "data:", "blob:"],
      mediaSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
}));

// CORS — dynamically allow origins in development
app.use(cors({
  origin: true,
  credentials: true,
}));


// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files (uploaded contracts)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend client files — no-cache during development so edits are always picked up
const clientPath = path.join(__dirname, '../client');
const staticOpts = { etag: false, lastModified: false, setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store'); } };
app.use(express.static(clientPath, staticOpts));
app.use('/pages',  express.static(path.join(clientPath, 'pages'),  staticOpts));
app.use('/public', express.static(path.join(clientPath, 'public'), staticOpts));

// Root redirect to login
app.get('/', (req, res) => {
  res.redirect('/pages/login.html');
});


// Auth rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'Marine Recruitment CRM — BDM Sales Pipeline API',
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api', bdmRoutes);
app.use('/api', pipelineRoutes);
app.use('/api', dashboardRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/employees', employeeRoutes); // alias path for employee routes
app.use('/api/crewing', crewingRoutes);
app.use('/api/ops', opsRoutes);
app.use('/api/reception', receptionRoutes);

// Legacy or malformed employee page URLs
app.get('/pages/employee=', (req, res) => res.redirect('/pages/employee.html'));
app.get('/employees', (req, res) => res.redirect('/pages/employee.html'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
});

// Global error handler
app.use(errorHandler);

module.exports = app;
