# Faff Chat - High School Rebellion

A real-time chat application with semantic search capabilities, built as a rebellion against traditional paper-based communication in high school.

## 🚀 Features

### Part 1: Basic Chat App (v0)
- ✅ User authentication (signup/login)
- ✅ Real-time messaging with Socket.IO
- ✅ Persistent message storage
- ✅ Modern, responsive UI
- ✅ Typing indicators
- ✅ Online/offline status

### Part 2: Semantic Search
- ✅ Hugging Face all-MiniLM-L6-v2 integration
- ✅ Vector database (pgvector) for embeddings
- ✅ Meaning-based message search
- ✅ Search results with similarity scores
- ✅ Automatic embedding generation for new messages

### Part 3: Scalability & Monitoring
- ✅ Comprehensive logging and metrics
- ✅ Rate limiting and security headers
- ✅ Health check endpoints
- ✅ Performance monitoring
- ✅ Graceful shutdown handling

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Real-time**: Socket.IO
- **Database**: PostgreSQL with pgvector extension (Supabase) 
- **Authentication**: JWT with bcrypt
- **Semantic Search**: HuggingFace Embeddings API
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Containerization**: Docker & Docker Compose
- **Monitoring**: Winston logging

## 📋 Prerequisites

- Node.js 18+ 
- Docker and Docker Compose
- HuggingFace API Token (for semantic search)
- PostgreSQL (or use Docker)

## 🚀 Quick Start

### Option 1: Docker (Recommended)

1. **Clone and setup**:
   ```bash
   git clone https://github.com/Tushar-exists/FaffChat

   ```

2. **Configure environment**:
   ```bash
   cp env.example .env
   # Edit .env with your HuggingFace API Token and other settings
   ```

3. **Start with Docker**:
   ```bash
   docker-compose up --build
   ```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - Health Check: http://localhost:3000/health
   - Metrics: http://localhost:3000/metrics

### Option 2: Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Setup database**:
   ```bash
   # Start PostgreSQL with pgvector
   docker run -d \
     --name postgres-chat \
     -e POSTGRES_DB=chat_app \
     -e POSTGRES_USER=postgres \
     -e POSTGRES_PASSWORD=password \
     -p 5432:5432 \
     pgvector/pgvector:pg16
   ```

3. **Initialize database**:
   ```bash
   psql -h localhost -U postgres -d chat_app -f init.sql
   ```

4. **Configure environment**:
   ```bash
   cp env.example .env
   # Edit .env with your settings
   ```

5. **Start the application**:
   ```bash
   npm run dev
   ```

### Backfill Existing Messages (Embeddings)

If messages were created while the embedding token was misconfigured, run the backfill to generate embeddings for rows where `embedding IS NULL`:

```bash
npm run backfill:embeddings
```

Optional environment tuning:
```bash
BACKFILL_BATCH_SIZE=200 BACKFILL_SLEEP_MS=50 npm run backfill:embeddings
```

## 📚 API Documentation

### Authentication Endpoints

#### POST /api/users
Create a new user account.
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

#### POST /api/login
Authenticate user and get JWT token.
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

#### GET /api/me
Get current user information (requires auth).

#### GET /api/users
Get all users (requires auth).

### Message Endpoints

#### POST /api/messages
Send a message (requires auth).
```json
{
  "receiverId": 2,
  "message": "Hello! How are you?"
}
```

#### GET /api/messages?userId=1&limit=99
Get recent messages for a user (requires auth).

#### GET /api/conversation/:userId?limit=50
Get conversation with specific user (requires auth).

### Semantic Search Endpoints

#### GET /api/semantic-search?q=query&limit=10
Search messages semantically (requires auth). Returns items shaped like:
```json
{
  "id": 123,
  "sender_id": 1,
  "receiver_id": 2,
  "sender_name": "Alice",
  "receiver_name": "Bob",
  "message": "Here are the homework answers...",
  "created_at": "2024-01-01T12:34:56.000Z",
  "similarity_score": 0.82
}
```

### Monitoring Endpoints

#### GET /health
Application health check.

#### GET /metrics
Application metrics and performance data.

## 🔍 Semantic Search Implementation

The application uses Hugging Face `sentence-transformers/all-MiniLM-L6-v2` (384-dim) to generate embeddings for all messages. These embeddings are stored in PostgreSQL using the pgvector extension.

### How it works:
1. When a message is sent, it's automatically embedded using Hugging Face Inference API (384-dim)
2. The embedding is stored alongside the message in the database (pgvector)
3. When searching, the query is embedded and compared using cosine similarity
4. Results are ranked by similarity score and returned

### Scaling Considerations:
- Embeddings are generated asynchronously to avoid blocking message delivery
- Fallback to zero vectors if OpenAI API is unavailable
- Vector indexing for efficient similarity search
- Batch processing for large-scale deployments

## 📊 Monitoring & Metrics

The application includes comprehensive monitoring:

### Logged Metrics:
- Messages sent/received
- Active connections
- Search queries and response times
- Error rates and types
- User activity patterns

### Health Checks:
- Database connectivity
- OpenAI API availability
- Memory usage
- Response times

### Performance Monitoring:
- Real-time metrics endpoint
- Structured logging with Winston
- Error tracking and alerting

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   (Browser)     │◄──►│   (Node.js)     │◄──►│   (PostgreSQL)  │
│                 │    │                 │    │   + pgvector    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────►│   Socket.IO     │              │
                        │   (Real-time)   │              │
                        └─────────────────┘              │
                                                         │
                        ┌─────────────────┐              │
                        │   HuggingFace   │              │
                        │   (Embeddings)  │              │
                        └─────────────────┘              │
```

## 🔒 Security Features

- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on API endpoints
- CORS protection
- Input validation and sanitization
- SQL injection prevention

## 🚀 Deployment

### Production Deployment

1. **Environment Setup**:
   ```bash
   NODE_ENV=production
   DATABASE_URL=your-production-db-url
   JWT_SECRET=your-secure-jwt-secret
   HF_API_TOKEN=your-hf-api-token
   ```

2. **Database Migration**:
   ```bash
   psql $DATABASE_URL -f init.sql
   ```

3. **Start Application**:
   ```bash
   npm start
   ```

### Docker Production
```bash
docker build  .
docker run -p 3000:3000 --env-file .env 
```

## 📈 Scaling Analysis (Part 3)

### Breaking Point Estimation

**Current Configuration**: GCP e2-standard-2 (2 vCPUs, 8GB RAM)

**Estimated Limits**:
- **Concurrent Users**: ~500-800 users
- **Messages/Second**: ~50-100 msg/sec
- **Database Connections**: ~100 concurrent

**Limiting Factors**:
1. **Database**: Connection pool exhaustion
2. **Memory**: Socket.IO connection overhead
3. **CPU**: Embedding generation bottleneck
4. **Network**: Socket.IO event processing

### Monitoring Implementation

The application logs critical metrics:
- Message throughput
- Connection counts
- Response times
- Error rates
- Resource utilization

### Scaling Strategies

1. **Horizontal Scaling**:
   - Load balancer for multiple app instances
   - Redis for Socket.IO session sharing
   - Database read replicas

2. **Vertical Scaling**:
   - Larger instance types
   - Connection pooling optimization
   - Caching layers

3. **Architecture Improvements**:
   - Message queue for embedding generation
   - CDN for static assets
   - Database sharding for large datasets

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For technical support or questions about the assignment, hmu @ www.tushar.kr.bh@gmail.com .

---

**Built with ❤️ for the Faff Engineering Assignment**

