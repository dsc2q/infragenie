#!/bin/bash
echo "Initializing local mock infrastructure..."
mkdir -p data/postgres data/redis
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi
docker compose up -d