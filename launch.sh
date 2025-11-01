#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Variables to track processes
SERVER_PID=""

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"
    
    if [ ! -z "$SERVER_PID" ]; then
        echo -e "${BLUE}Stopping server (PID: $SERVER_PID)...${NC}"
        kill -TERM "$SERVER_PID" 2>/dev/null
        wait "$SERVER_PID" 2>/dev/null
    fi
    
    # Kill any remaining node processes for this project
    pkill -P $$ 2>/dev/null
    
    echo -e "${GREEN}Cleanup complete. Goodbye!${NC}"
    exit 0
}

# Set up trap to catch exit signals
trap cleanup SIGINT SIGTERM EXIT

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  🎲 Snakes & Ladders Launcher 🪜${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo -e "${YELLOW}Installing Node.js and npm...${NC}"
    
    if command -v apt &> /dev/null; then
        sudo apt update
        sudo apt install -y nodejs npm
    elif command -v yum &> /dev/null; then
        sudo yum install -y nodejs npm
    elif command -v brew &> /dev/null; then
        brew install node
    else
        echo -e "${RED}Could not detect package manager. Please install Node.js manually.${NC}"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Failed to install Node.js. Please install it manually.${NC}"
        exit 1
    fi
fi

# Check Node.js version
NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js installed: ${NODE_VERSION}${NC}"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ npm installed: ${NPM_VERSION}${NC}\n"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Dependencies installed successfully${NC}\n"
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}\n"
fi

# Get local IP address
echo -e "${BLUE}🌐 Network Information:${NC}"
LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

if [ -z "$LOCAL_IP" ]; then
    # Fallback for macOS
    LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
fi

echo -e "${GREEN}   Local IP: ${LOCAL_IP}${NC}"
echo -e "${BLUE}   Port: 3000${NC}\n"

echo -e "${YELLOW}📡 Access URLs:${NC}"
echo -e "   ${GREEN}Local:${NC}   http://localhost:3000"
if [ ! -z "$LOCAL_IP" ]; then
    echo -e "   ${GREEN}Network:${NC} http://${LOCAL_IP}:3000"
fi
echo ""

# Check if port 3000 is already in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 3000 is already in use${NC}"
    echo -e "${YELLOW}   Attempting to kill existing process...${NC}"
    lsof -ti:3000 | xargs kill -9 2>/dev/null
    sleep 2
fi

# Start the server
echo -e "${GREEN}🚀 Starting game server...${NC}\n"
echo -e "${BLUE}========================================${NC}\n"

# Start server in background and capture PID
node server.js &
SERVER_PID=$!

# Wait a moment to check if server started successfully
sleep 2

if ! ps -p $SERVER_PID > /dev/null; then
    echo -e "\n${RED}❌ Server failed to start${NC}"
    exit 1
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Server is running!${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}Instructions:${NC}"
echo -e "  1. Open the URL in your browser"
echo -e "  2. Share the Network URL with friends"
echo -e "  3. Press ${RED}Ctrl+C${NC} to stop the server\n"

# Try to open browser automatically (optional)
if command -v xdg-open &> /dev/null; then
    echo -e "${BLUE}🌐 Opening browser...${NC}\n"
    xdg-open "http://localhost:3000" &>/dev/null &
elif command -v open &> /dev/null; then
    echo -e "${BLUE}🌐 Opening browser...${NC}\n"
    open "http://localhost:3000" &>/dev/null &
fi

# Keep script running and wait for server
wait $SERVER_PID
