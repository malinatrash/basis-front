#!/bin/bash

echo "Starting Category Mapping Server..."
cd "$(dirname "$0")/server"
npm start &
SERVER_PID=$!

echo "Server running with PID: $SERVER_PID"
echo "Starting Web Server..."
cd "$(dirname "$0")"
python3 -m http.server 8000 &
WEB_PID=$!

echo "Web Server running with PID: $WEB_PID"
echo "Open http://localhost:8000 in your browser to use the application"

function cleanup {
  echo "Stopping services..."
  kill $SERVER_PID
  kill $WEB_PID
  exit
}

# Trap Ctrl+C to properly shut down both processes
trap cleanup INT

# Wait for user input
echo "Press Ctrl+C to stop all services"
wait
