#!/bin/bash

echo "========================================"
echo "Building and starting Docker containers"
echo "========================================"

# Stop any existing containers
echo "Stopping any existing containers..."
docker-compose down

# Build and start containers
echo "Building and starting containers..."
docker-compose up --build -d

# Check if containers started successfully
echo "Checking container status..."
docker-compose ps

echo ""
echo "============================================="
echo "Category Mapping service is now running at:"
echo "Frontend: http://localhost"
echo "Backend API: http://localhost:3000/api/status"
echo "============================================="
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"
echo ""
