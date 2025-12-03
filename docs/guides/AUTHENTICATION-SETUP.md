# Authentication System Setup Guide

## Overview

A complete MongoDB-based authentication system has been implemented for the Multi-Agent Chatbot System with the following features:

- ✅ User Registration & Login
- ✅ JWT-based Authentication
- ✅ Password Hashing (bcrypt)
- ✅ Protected Routes
- ✅ Conversation Persistence
- ✅ User Memory System
- ✅ Session Management

---

## Architecture

### Backend Components

1. **Database Layer** (`src/config/database.js`)
   - MongoDB connection with Mongoose
   - Auto-reconnection handling
   - Error logging

2. **Models**
   - `User` (`src/models/User.js`) - User accounts with password hashing
   - `Conversation` (`src/models/Conversation.js`) - Chat history per user
   - `Memory` (`src/models/Memory.js`) - User preferences and context

3. **Authentication**
   - JWT utilities (`src/utils/jwt.js`) - Token generation/verification
   - Auth middleware (`src/middleware/auth.js`) - Route protection
   - Auth routes (`src/routes/auth.js`) - Login/signup/logout endpoints

4. **API Routes**
   - `POST /api/auth/signup` - Create new account
   - `POST /api/auth/login` - Authenticate user
   - `POST /api/auth/logout` - End session
   - `GET /api/auth/me` - Get current user
   - `PUT /api/auth/update-profile` - Update user info
   - `GET /api/conversations` - Get user's conversations
   - `POST /api/conversations` - Create new conversation
   - `GET /api/conversations/:id` - Get conversation with messages
   - `POST /api/conversations/:id/messages` - Add message to conversation

### Frontend Components

1. **Authentication Pages**
   - `/signup` - User registration with validation
   - `/login` - User authentication
   - Protected `/chat` - Requires authentication

2. **Auth Utilities** (`lib/auth.ts`)
   - Token management
   - User session handling
   - Logout functionality
   - Auth state checking

---

## Installation & Setup

### 1. Install MongoDB

#### On WSL/Linux:
```bash
# Import MongoDB public key
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# Update packages
sudo apt-get update

# Install MongoDB
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod

# Enable auto-start on boot
sudo systemctl enable mongod

# Verify MongoDB is running
sudo systemctl status mongod
```

#### On Windows:
Download and install from: https://www.mongodb.com/try/download/community

#### On macOS:
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

### 2. Verify MongoDB Connection

```bash
# Connect to MongoDB shell
mongosh

# Should see MongoDB shell prompt
# Exit with: exit
```

### 3. Configure Environment Variables

The `.env` file has been updated with:
```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/multi-agent-chatbot

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d

# Frontend URL
FRONTEND_URL=http://localhost:3002
```

**IMPORTANT**: Change `JWT_SECRET` to a secure random string in production!

### 4. Dependencies Installed

Backend dependencies:
- `mongoose` - MongoDB ODM
- `bcryptjs` - Password hashing
- `jsonwebtoken` - JWT tokens
- `cookie-parser` - Cookie handling

Frontend dependencies:
- `js-cookie` - Cookie management

---

## Testing the Authentication System

### 1. Start MongoDB
```bash
sudo systemctl start mongod  # Linux/WSL
# Or start MongoDB service on Windows/Mac
```

### 2. Start Backend Server
```bash
cd /mnt/c/Users/karti/Multi-Agent-Chatbot-System
npm start
```

The server will:
- Connect to MongoDB automatically
- Start on port 3000
- Serve auth API endpoints

### 3. Start Frontend
```bash
cd multi-agent-chatbot
npm run dev
```

Frontend runs on http://localhost:3002 (or the port shown)

### 4. Test the Flow

1. **Create Account**
   - Navigate to http://localhost:3002/signup
   - Fill in:
     - Full Name
     - Email
     - Password (min 6 characters)
     - Confirm Password
   - Check "I agree to terms"
   - Click "Create Account"

2. **Login**
   - If redirected or going to http://localhost:3002/login
   - Enter your email and password
   - Click "Sign in"

3. **Access Chat**
   - Should automatically redirect to `/chat`
   - See welcome message with your name
   - Logout button in header

4. **Test Protection**
   - Click logout
   - Try to access http://localhost:3002/chat directly
   - Should redirect to login page

### 5. Verify in MongoDB

```bash
mongosh
use multi-agent-chatbot
db.users.find().pretty()  # See all users
db.conversations.find().pretty()  # See conversations
```

---

## API Usage Examples

### Register User
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "confirmPassword": "password123"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Get Current User (with token)
```bash
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Create Conversation
```bash
curl -X POST http://localhost:3000/api/conversations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Chat",
    "agentType": "manager"
  }'
```

---

## Security Features

1. **Password Security**
   - Passwords hashed with bcrypt (10 salt rounds)
   - Never stored in plain text
   - Password field excluded from queries by default

2. **JWT Tokens**
   - Secure token generation
   - 7-day expiration
   - Verified on each protected request
   - Stored in both cookies and localStorage

3. **Protected Routes**
   - Middleware checks for valid tokens
   - Automatically rejects unauthorized requests
   - Frontend redirects to login if not authenticated

4. **CORS Protection**
   - Only allows requests from configured frontend URL
   - Credentials included in requests

---

## Database Schema

### User Collection
```javascript
{
  _id: ObjectId,
  fullName: String,
  email: String (unique),
  password: String (hashed),
  isActive: Boolean,
  lastLogin: Date,
  preferences: {
    theme: String,
    notifications: Boolean
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Conversation Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  title: String,
  messages: [{
    role: String ('user' | 'assistant' | 'system'),
    content: String,
    agentId: String,
    timestamp: Date,
    metadata: Object
  }],
  agentType: String,
  status: String ('active' | 'archived' | 'deleted'),
  tags: [String],
  metadata: {
    totalMessages: Number,
    lastMessageAt: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Memory Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  agentId: String,
  entries: [{
    type: String ('CONVERSATION' | 'PREFERENCE' | 'FACT' | 'SKILL' | 'RELATIONSHIP'),
    content: String,
    importance: Number (0-1),
    timestamp: Date,
    lastAccessed: Date,
    accessCount: Number,
    metadata: Map
  }],
  lastUpdated: Date,
  createdAt: Date,
  updatedAt: Date
}
```

---

## Next Steps

1. **Integrate Conversation Saving**
   - Update message handlers in `src/agents/manager/index.js`
   - Use `conversationService.js` to save messages
   - Link conversations to authenticated users

2. **Enhance Memory System**
   - Migrate from JSON files to MongoDB Memory model
   - Update `src/shared/memory.js` to use database

3. **Add Features**
   - Password reset functionality
   - Email verification
   - Social login (GitHub, Google)
   - User profile management
   - Conversation search and filtering

4. **Production Deployment**
   - Use MongoDB Atlas for cloud hosting
   - Set strong JWT_SECRET
   - Enable HTTPS
   - Implement rate limiting
   - Add request validation

---

## Troubleshooting

### MongoDB Connection Errors
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Restart MongoDB
sudo systemctl restart mongod

# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

### Authentication Fails
- Verify JWT_SECRET in `.env`
- Check token in browser localStorage
- Inspect network requests in DevTools
- Check backend logs for errors

### CORS Issues
- Ensure FRONTEND_URL matches your frontend port
- Check cookies are being set
- Verify credentials: 'include' in fetch requests

---

## Files Created/Modified

### New Files
- `src/config/database.js` - MongoDB connection
- `src/models/User.js` - User model
- `src/models/Conversation.js` - Conversation model
- `src/models/Memory.js` - Memory model
- `src/utils/jwt.js` - JWT utilities
- `src/middleware/auth.js` - Auth middleware
- `src/routes/auth.js` - Auth API routes
- `src/routes/conversations.js` - Conversation API routes
- `src/services/conversationService.js` - Conversation service layer
- `multi-agent-chatbot/lib/auth.ts` - Frontend auth utilities

### Modified Files
- `src/agents/manager/index.js` - Added auth routes, MongoDB connection
- `multi-agent-chatbot/app/signup/page.tsx` - Real authentication
- `multi-agent-chatbot/app/login/page.tsx` - Real authentication
- `multi-agent-chatbot/app/chat/page.tsx` - Protected route with auth check
- `.env` - MongoDB and JWT configuration
- `package.json` (root) - Added auth dependencies

---

## Support

For issues or questions:
1. Check MongoDB is running
2. Verify environment variables
3. Check browser console and network tab
4. Review backend logs
5. Ensure all dependencies are installed

Happy coding! 🚀
