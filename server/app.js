const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const morgan = require('morgan');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const fs = require('fs');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { recoverPdf } = require('./services/certificate.service');
const app = express();

// Enable trust proxy for Render deployment (if behind load balancer)
app.set('trust proxy', 1);

// Rate Limiting (100 requests per 15 minutes per IP)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Compress all responses
app.use(compression());

// Security Middleware
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' })); // Allow images to load cross origin
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://certificate.spheronixtechnology.com',
      'https://company-certificate-frontend.onrender.com'
    ];
    
    if (process.env.FRONTEND_URL) {
      const envUrls = process.env.FRONTEND_URL.split(',').map(url => url.trim());
      allowedOrigins.push(...envUrls);
    }

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked by CORS: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Data sanitization against NoSQL query injection
// Express 5 makes req.query a getter-only property, so express-mongo-sanitize crashes.
// Mongoose's built-in strict schema casting will handle basic NoSQL injection protection.
// app.use(mongoSanitize());

// Data sanitization against XSS
// Express 5+ compatibility issue
// app.use(xss());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Serve static files (PDFs, QRs, etc) with Cache-Control headers
const staticOptions = {
  maxAge: '1d', // Cache static files for 1 day in production
  immutable: true
};
app.use('/pdfs', express.static(path.join(__dirname, 'pdfs'), staticOptions));

// Fallback for Render Ephemeral Storage: Regenerate PDF if it doesn't exist on disk
app.get('/pdfs/:fileName', async (req, res, next) => {
  try {
    const certificateId = req.params.fileName.replace('.pdf', '');
    const pdfPath = await recoverPdf(certificateId);
    if (!pdfPath) return res.status(404).json({ success: false, message: 'Certificate not found' });
    
    // Serve the newly generated file
    res.sendFile(path.join(__dirname, pdfPath));
  } catch (error) {
    next(error);
  }
});

app.use('/qrcodes', express.static(path.join(__dirname, 'qrcodes'), staticOptions));
app.use('/bulk', express.static(path.join(__dirname, 'public', 'bulk'), staticOptions));

// Swagger Documentation
const swaggerPath = path.join(__dirname, 'docs', 'swagger.yaml');
if (fs.existsSync(swaggerPath)) {
    const swaggerDocument = YAML.load(swaggerPath);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// Basic Route for testing
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Import Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/certificates', require('./routes/certificateRoutes'));
app.use('/api/verify', require('./routes/verifyRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));

// Error handling middleware
app.use(require('./middleware/errorHandler'));

module.exports = app;
