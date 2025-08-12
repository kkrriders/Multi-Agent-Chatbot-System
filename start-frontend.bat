@echo off
echo 🚀 Starting Multi-Agent Chatbot System with Frontend...
echo.

echo 📡 Starting backend server...
start "Backend" cmd /c "node start-stable.js"

echo ⏳ Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo 🎨 Starting Next.js frontend...
cd multi-agent-chatbot
start "Frontend" cmd /c "set PORT=3001 && npm run dev"

echo.
echo 📖 Access the application at:
echo    Frontend: http://localhost:3001
echo    Backend API: http://localhost:3000/api/health
echo.
echo 🏃‍♂️ Close both terminal windows to stop all services
pause