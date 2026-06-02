#!/usr/bin/env bash
# exit on error
set -o errexit

echo "==> Python version: $(python --version)"

# Install backend dependencies
cd backend
pip install --upgrade pip
pip install -r requirements.txt

# Build frontend
cd ../frontend
npm install
npm run build

echo "==> Build complete. Frontend dist contents:"
ls -la dist/
