#!/bin/bash
echo "Pulling latest code from Git..."
git pull
echo "Setting up Python Virtual Environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
echo "Installing dependencies..."
pip install -r requirements.txt
echo "Starting Salesforce Metadata Deployer..."
uvicorn app:app --reload --port 8000
