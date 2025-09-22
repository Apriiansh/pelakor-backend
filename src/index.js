const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const pool = require('./db'); 
const path = require('path');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users'); 
const laporanRoutes = require('./routes/laporan'); 
const disposisiRoutes = require('./routes/disposisi'); 
const tindakRoutes = require('./routes/tindaklanjut'); 

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Enhanced CORS configuration for web support
const corsOptions = {
  origin: [
    // Expo mobile development
    'http://localhost:8081', 
    'http://192.168.18.47:8081', 
    'exp://192.168.18.47:8081',
    
    // Expo web development
    'http://localhost:19006',
    'http://127.0.0.1:19006',
    'http://192.168.18.47:19006',
    
    // Common development ports
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://192.168.18.47:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type', 
    'Accept',
    'Authorization',
    'Cache-Control'
  ]
};

// Apply CORS middleware
app.use(cors(corsOptions));

app.use(express.json());

// Enhanced logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const origin = req.get('Origin') || 'no-origin';
  
  console.log(`${timestamp} - ${req.method} ${req.path}`, {
    origin: origin.substring(0, 50),
    userAgent: req.get('User-Agent') ? req.get('User-Agent').substring(0, 50) + '...' : 'no-user-agent'
  });
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/laporan', laporanRoutes);
app.use('/api/disposisi', disposisiRoutes);
app.use('/api/tindaklanjut', tindakRoutes);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'PELAKOR Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    corsEnabled: true,
    allowedOrigins: corsOptions.origin,
    endpoints: {
      auth: '/api/auth/login',
      test: '/test-db',
      health: '/health',
      cors: '/test-cors'
    }
  });
});

// Database connection test
app.get('/test-db', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    client.release();
    
    res.json({
      success: true,
      message: 'Database connected successfully',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Database connection error:', err);
    res.status(500).json({
      success: false,
      message: 'Error connecting to database',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cors: {
      enabled: true,
      allowedOrigins: corsOptions.origin.length
    }
  });
});

// Test CORS endpoint
app.get('/test-cors', (req, res) => {
  res.json({
    success: true,
    message: 'CORS working correctly',
    requestOrigin: req.get('Origin'),
    timestamp: new Date().toISOString(),
    headers: {
      origin: req.get('Origin'),
      userAgent: req.get('User-Agent') ? req.get('User-Agent').substring(0, 100) : null
    }
  });
});

// 404 handler - Fixed: Proper middleware pattern
app.use((req, res) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      'GET /',
      'GET /health', 
      'GET /test-db',
      'GET /test-cors',
      'POST /api/auth/login',
      'GET /api/auth/test'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`\n🚀 PELAKOR Backend Server Started`);
  console.log(`📍 Local: http://localhost:${port}`);
  console.log(`📍 Network: http://192.168.18.47:${port}`);
  console.log(`🌐 Web Access: http://localhost:${port}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 CORS Origins: ${corsOptions.origin.length} origins configured`);
  
  // Test endpoints
  console.log(`\n🧪 Test these endpoints:`);
  console.log(`   GET  http://localhost:${port}/health`);
  console.log(`   GET  http://localhost:${port}/test-cors`);
  console.log(`   GET  http://localhost:${port}/api/auth/test`);
  console.log(`   POST http://localhost:${port}/api/auth/login`);
  console.log(`\n✅ Server ready to accept connections!`);
});