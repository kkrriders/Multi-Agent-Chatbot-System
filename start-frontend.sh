#!/bin/bash

echo "🚀 Starting Multi-Agent Chatbot System with Frontend..."
echo

# Function to cleanup processes on exit
cleanup() {
    echo
    echo "🛑 Shutting down servers..."
    jobs -p | xargs -r kill
    exit 0
}

# Set trap to cleanup on Ctrl+C
trap cleanup SIGINT

echo "📡 Starting backend server..."
node start-stable.js &
BACKEND_PID=$!

echo "⏳ Waiting for backend to start..."
sleep 5

echo "🎨 Starting Next.js frontend..."
cd multi-agent-chatbot
PORT=3001 npm run dev &
FRONTEND_PID=$!

echo
echo "📖 Access the application at:"
echo "   Frontend: http://localhost:3001"
echo "   Backend API: http://localhost:3000/api/health"
echo
echo "🏃‍♂️ Press Ctrl+C to stop all services"

# Wait for background processes
wait