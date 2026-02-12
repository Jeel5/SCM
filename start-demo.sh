#!/bin/bash

# SCM Demo Quick Start Script
# This script helps you launch the demo quickly

echo "🚀 SCM Two-Phase Quote System - Quick Start"
echo "============================================"
echo ""

# Check if backend directory exists
if [ ! -d "backend" ]; then
    echo "❌ Error: backend directory not found"
    echo "Please run this script from the SCM project root"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "backend/node_modules" ]; then
    echo "⚠️  Node modules not found. Installing dependencies..."
    cd backend
    npm install
    cd ..
fi

echo "✅ Starting backend server..."
echo ""
cd backend
npm start &
BACKEND_PID=$!
cd ..

echo "⏳ Waiting for server to start..."
sleep 3

echo ""
echo "✅ Backend server started!"
echo ""
echo "📂 Demo files are in the /demo directory"
echo ""
echo "🌐 Access the demo:"
echo "   - Option 1: Open demo/index.html in your browser"
echo "   - Option 2: Use http-server (npm install -g http-server):"
echo "       cd demo && http-server -p 8080"
echo ""
echo "📋 Next steps:"
echo "   1. Open demo/index.html in your browser"
echo "   2. Click 'Customer Portal' to start"
echo "   3. Select a product and place an order"
echo "   4. Open 'Carrier Portal' to respond to quotes"
echo "   5. Check 'Order Tracking' to see the flow"
echo ""
echo "🛑 To stop the backend: kill $BACKEND_PID"
echo ""
echo "Press Ctrl+C to stop this script (backend will keep running)"
echo ""

# Keep script running
wait $BACKEND_PID
