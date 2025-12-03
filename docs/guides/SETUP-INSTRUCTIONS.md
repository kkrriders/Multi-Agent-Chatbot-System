# 🚀 Setup Instructions - Multi-Agent AI System

## ✅ All Issues Fixed!

The following issues have been resolved:

1. ✅ **Backend dependencies installed** (166 packages)
2. ✅ **Frontend dependencies installed** (206 packages, 0 vulnerabilities)
3. ✅ **Port configuration fixed** (updated to 3002)
4. ✅ **Git line endings configured** (set to `input` for WSL2)
5. ✅ **Professional UI created** (Homepage, Login, Signup, Chat)

---

## 🎨 New UI Structure

Your application now has a **professional, production-ready interface**:

### Pages Created:
- **`/`** - Beautiful landing page with features and CTA
- **`/login`** - Professional login page with social auth
- **`/signup`** - Registration page with validation
- **`/chat`** - Multi-agent collaboration interface

---

## 🏃 Quick Start

### 1. Start Backend Server
```bash
# From project root
node start-stable.js
```

This starts:
- Manager Agent (Port 3000)
- 4 AI Agents (Ports 3005-3008)
- Performance Monitor (Port 3099)

### 2. Start Frontend
```bash
# In a new terminal
npm run start-frontend-only
```

Or start both together:
```bash
npm run start-with-frontend
```

### 3. Access the Application

- **Homepage**: http://localhost:3002
- **Login**: http://localhost:3002/login
- **Signup**: http://localhost:3002/signup
- **Chat**: http://localhost:3002/chat
- **Backend API**: http://localhost:3000
- **Performance Monitor**: http://localhost:3099

---

## 📋 Prerequisites Check

### Before Starting:

1. **Node.js 16+** installed
   ```bash
   node --version  # Should show v16 or higher
   ```

2. **Ollama running** with models downloaded
   ```bash
   # On Windows (run in PowerShell)
   $env:OLLAMA_HOST="0.0.0.0:11434"
   ollama serve

   # Check models
   ollama list
   ```

3. **Required Models:**
   ```bash
   ollama pull llama3:latest
   ollama pull mistral:latest
   ollama pull phi3:latest
   ollama pull qwen2.5-coder:latest
   ```

---

## 🔧 Configuration

### Environment Variables

Edit `.env` file:
```bash
# Agent Ports
MANAGER_PORT=3000
AGENT_1_PORT=3005
AGENT_2_PORT=3006
AGENT_3_PORT=3007
AGENT_4_PORT=3008

# Frontend
FRONTEND_PORT=3002

# Ollama
OLLAMA_API_BASE=http://localhost:11434/api
# For WSL2: OLLAMA_API_BASE=http://172.18.224.1:11434/api

# Timeouts
OLLAMA_TIMEOUT=180000
AGENT_TIMEOUT=180000
```

---

## 🎯 Testing the System

### 1. Test Backend
```bash
# Check manager health
curl http://localhost:3000/status

# Expected response:
# {"status":"ok","agents":[...]}
```

### 2. Test Frontend
1. Open http://localhost:3002
2. Click "Try Demo" or navigate to /chat
3. Enable 2-3 agents
4. Enter a task: "Explain quantum computing"
5. Click "Start Task"
6. Watch agents collaborate in real-time!

### 3. Test Authentication Pages
- Visit `/login` - Login form should display
- Visit `/signup` - Signup form should display
- Forms redirect to `/chat` (authentication not yet connected to backend)

---

## 🐛 Troubleshooting

### Frontend won't start
```bash
# Clear cache and rebuild
cd multi-agent-chatbot
rm -rf .next node_modules
npm install
npm run dev
```

### Backend connection error
- Ensure backend is running on port 3000
- Check if Ollama is accessible
- Verify WSL2 network settings (if on Windows)

### WebSocket not connecting
- Check browser console for errors
- Ensure no firewall blocking port 3000
- Try refreshing the page

### Models not found
```bash
# Download all required models
ollama pull llama3:latest
ollama pull mistral:latest
ollama pull phi3:latest
ollama pull qwen2.5-coder:latest

# Verify
ollama list
```

---

## 📚 Next Steps

### Immediate (Recommended):

1. **Add Backend Authentication**
   - Create `/api/auth/login` endpoint
   - Create `/api/auth/signup` endpoint
   - Implement JWT tokens
   - Add protected routes

2. **Database Integration**
   - Set up PostgreSQL for conversations
   - Add Redis for caching
   - Implement user sessions

3. **Security**
   - Add rate limiting
   - Configure CORS properly
   - Implement HTTPS

### See Full Roadmap:
- `UI-GUIDE.md` - Frontend customization guide
- `README.md` - Complete project documentation
- `docs/` - Detailed architecture docs

---

## 🎨 UI Customization

### Change Branding Colors
Edit pages to use your colors:
```tsx
// Current: Blue to Purple gradient
className="bg-gradient-to-r from-blue-600 to-purple-600"

// Example: Green to Teal
className="bg-gradient-to-r from-green-600 to-teal-600"
```

### Add Your Logo
Replace the `<Bot>` icon in navigation:
```tsx
// In app/page.tsx, app/login/page.tsx, etc.
<Bot className="h-6 w-6" />  // Replace with your logo
```

### Customize Text
All text is editable in the respective page files:
- Homepage: `app/page.tsx`
- Login: `app/login/page.tsx`
- Signup: `app/signup/page.tsx`

---

## 📊 Architecture Overview

```
┌─────────────────────────────────────┐
│   Next.js Frontend (Port 3002)     │
│   - Homepage, Auth, Chat UI         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Manager Agent (Port 3000)         │
│   - REST API + WebSocket            │
└──────────────┬──────────────────────┘
               │
      ┌────────┼────────┐
      │        │        │
┌─────▼──┐ ┌──▼───┐ ┌──▼───┐
│Agent-1 │ │Agent-2│ │Agent-3│ ...
│ :3005  │ │ :3006 │ │ :3007 │
└────────┘ └───────┘ └───────┘
               │
┌──────────────▼──────────────────────┐
│   Ollama Backend                    │
│   - GPU Model Management            │
└─────────────────────────────────────┘
```

---

## 💡 Usage Tips

1. **Agent Teams**: Use pre-configured templates:
   - Coding Team - For software development
   - Research Team - For analysis and insights
   - Business Team - For strategy and planning
   - Creative Team - For content and design

2. **Custom Prompts**: Modify agent roles for specific tasks
   - Example: "You are a senior Python developer focused on clean code"

3. **Real-Time Collaboration**: Watch agents discuss and build on each other's ideas

4. **Continue Conversations**: Ask follow-up questions after initial responses

---

## 🔐 Security Notes

**⚠️ IMPORTANT - Current State:**
- Authentication UI exists but not connected to backend
- No user database yet
- All endpoints are public
- CORS allows all origins

**Before Production:**
- [ ] Implement JWT authentication
- [ ] Add database with user accounts
- [ ] Configure CORS whitelist
- [ ] Add rate limiting
- [ ] Enable HTTPS
- [ ] Implement input validation
- [ ] Add CSRF protection

---

## 📞 Need Help?

- **Documentation**: See `/docs` folder
- **UI Guide**: See `UI-GUIDE.md`
- **Issues**: Create GitHub issue
- **Architecture**: See `README.md`

---

## ✨ What's New

### v3.0.0 - Professional UI Update

✅ **New Homepage**
- Modern landing page design
- Feature showcase
- Call-to-action sections
- Responsive layout

✅ **Authentication Pages**
- Login page with social auth
- Signup page with validation
- Password visibility toggles
- Terms agreement

✅ **Chat Interface**
- Preserved multi-agent functionality
- Real-time WebSocket updates
- Team templates
- Custom agent configuration

✅ **Technical Improvements**
- All dependencies installed
- Port configuration fixed
- Git line endings configured
- Zero build errors

---

**🎉 You're all set! Start building with Multi-Agent AI!**

For questions or feedback, check the documentation or create an issue.
