const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const pool = require('./db'); 

const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users'); 
const laporanRoutes = require('./routes/laporan'); 
const disposisiRoutes = require('./routes/disposisi'); 
const tindakRoutes = require('./routes/tindaklanjut'); 


dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ['http://localhost:8081', 'http://192.168.18.47:8081', 'exp://192.168.18.47:8081'], 
  credentials: true
}));
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/laporan', laporanRoutes);
app.use('/api/disposisi', disposisiRoutes);
app.use('/api/tindaklanjut', tindakRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'PELAKOR Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth/login',
      test: '/test-db',
      health: '/health'
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
    memory: process.memoryUsage()
  });
});

// General 404 handler - Fixed: Use proper route pattern
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 PELAKOR Backend Server`);
  console.log(`📍 Local: http://localhost:${port}`);
  console.log(`📍 Network: http://192.168.18.47:${port}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
});