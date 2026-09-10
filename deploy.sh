#!/bin/bash
set -e

# Configuration
# Replace 'jikanzo-server' with the actual IP address (e.g., 192.168.22.78) or SSH alias you use to connect
REMOTE_HOST="root@192.168.22.78" 
REMOTE_DIR="/root/jikanzo"

echo "🚀 Starting deployment to $REMOTE_HOST..."

echo "📦 Syncing files..."
# This pushes files from your current local directory to the server
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' ./ $REMOTE_HOST:$REMOTE_DIR

echo "🐳 Building and starting Docker containers on remote..."
# Connects to the server, navigates to the directory, and runs docker compose
ssh $REMOTE_HOST "cd $REMOTE_DIR && docker compose up -d --build"

echo "✅ Deployment complete!"
