require('dotenv').config();

const http = require('http');
const path = require('path');

const express = require('express');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const { validateAndNormalizeEnv } = require('./utils/validateEnv');
const { logger, logConnectionChange, logError, getMetrics } = require('./utils/logger');
const pool = require('./config/database');
const { initDatabase } = require('./utils/dbInit');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const User = require('./models/User');

validateAndNormalizeEnv();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || `http://localhost:${PORT}`;

const io = socketIo(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

const connectedUsers = new Map();

// --- Middleware Setup ---
app.set('io', io);
app.set('connectedUsers', connectedUsers);
app.use(helmet());
app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files like CSS, JS, or images from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// --- API Rate Limiting ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', apiLimiter);

// --- API Routes ---
app.use('/api', authRoutes);
app.use('/api', messageRoutes);

// --- Health and Metrics Routes ---
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ status: 'OK', db: 'connected' });
  } catch (error) {
    res.status(503).json({ status: 'UNAVAILABLE', db: 'unreachable' });
  }
});

app.get('/metrics', (req, res) => {
  res.json(getMetrics());
});

// --- Socket.IO Connection Handling ---
io.on('connection', (socket) => {
  logger.info(`User connected with socket ID: ${socket.id}`);

  socket.on('authenticate', async (token) => {
    try {
      if (!token) return socket.emit('auth_error', { message: 'Authentication token not provided.' });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (user) {
        socket.userId = user.id;
        socket.userName = user.name;
        connectedUsers.set(user.id, socket.id);

        logConnectionChange('connect', user.id);
        socket.emit('authenticated', { userId: user.id, userName: user.name });
        socket.broadcast.emit('user_online', { userId: user.id, userName: user.name });
      } else {
        socket.emit('auth_error', { message: 'User not found.' });
      }
    } catch (error) {
      logError(error, { socketId: socket.id, event: 'authenticate' });
      socket.emit('auth_error', { message: 'Authentication failed. Invalid token.' });
    }
  });

  socket.on('typing', (data) => {
    const recipientSocketId = connectedUsers.get(data.userId || data.receiverId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user_typing', { senderId: socket.userId });
    }
  });

  socket.on('stop_typing', (data) => {
    const recipientSocketId = connectedUsers.get(data.userId || data.receiverId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('user_stop_typing', { senderId: socket.userId });
    }
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      logConnectionChange('disconnect', socket.userId);
      socket.broadcast.emit('user_offline', { userId: socket.userId, userName: socket.userName });
    }
    logger.info(`User disconnected: ${socket.id}`);
  });
});

// --- Catch-all for API routes that don't exist ---
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// --- Catch-all for Frontend serving ---
// This MUST be after all API routes and before the final error handler.
// It serves the index.html for any non-API request.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Final Error Handler ---
app.use((err, req, res, next) => {
  logError(err, { url: req.originalUrl, method: req.method });
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// --- Server Startup Logic ---
const startServer = async () => {
  try {
    logger.info('Initializing database...');
    await initDatabase(pool);

    server.listen(PORT, () => {
      logger.info(`🚀 Chat server running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`📈 Metrics: http://localhost:${PORT}/metrics`);
    });
  } catch (error) {
    logError(error, { context: 'Server Startup' });
    process.exit(1);
  }
};

const gracefulShutdown = (signal) => {
  logger.info(`${signal} received, shutting down gracefully.`);
  server.close(() => {
    logger.info('HTTP server closed.');
    pool.end(() => {
      logger.info('Database pool closed.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
