const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'chat-app' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const metrics = {
  messagesSent: 0,
  messagesReceived: 0,
  activeConnections: 0,
  searchQueries: 0,
  errors: 0,
  responseTimes: []
};

function logMessageSent(senderId, receiverId, messageLength) {
  metrics.messagesSent++;
  logger.info('Message sent', {
    senderId,
    receiverId,
    messageLength,
    timestamp: new Date().toISOString(),
    metric: 'message_sent'
  });
}

function logConnectionChange(type, userId) {
  if (type === 'connect') {
    metrics.activeConnections++;
  } else if (type === 'disconnect') {
    metrics.activeConnections = Math.max(0, metrics.activeConnections - 1);
  }
  
  logger.info('Connection change', {
    type,
    userId,
    activeConnections: metrics.activeConnections,
    timestamp: new Date().toISOString(),
    metric: 'connection_change'
  });
}

function logSearchQuery(userId, query, resultCount, responseTime) {
  metrics.searchQueries++;
  metrics.responseTimes.push(responseTime);
  
  if (metrics.responseTimes.length > 100) {
    metrics.responseTimes.shift();
  }
  
  logger.info('Search query', {
    userId,
    query,
    resultCount,
    responseTime,
    timestamp: new Date().toISOString(),
    metric: 'search_query'
  });
}

function logError(error, context = {}) {
  metrics.errors++;
  logger.error('Application error', {
    error: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    metric: 'error'
  });
}

function getMetrics() {
  const avgResponseTime = metrics.responseTimes.length > 0 
    ? metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length 
    : 0;
    
  return {
    ...metrics,
    avgResponseTime: Math.round(avgResponseTime * 100) / 100
  };
}

module.exports = {
  logger,
  logMessageSent,
  logConnectionChange,
  logSearchQuery,
  logError,
  getMetrics
};