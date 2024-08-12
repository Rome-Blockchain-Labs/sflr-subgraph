#!/bin/bash

# Set default values for variables
SUBGRAPH_NAME="${SUBGRAPH_NAME:-sflr-subgraph}"
NODE_URL="${NODE_URL:-http://127.0.0.1:18020/}"
IPFS_URL="${IPFS_URL:-http://127.0.0.1:15001}"
VERSION="${VERSION:-0.0.4}"

echo "Deploying subgraph: $SUBGRAPH_NAME with version: $VERSION"

# Wait for Graph Node to be ready
echo 'Waiting for graph-node to be ready...'
while ! curl -s "$NODE_URL" > /dev/null; do
    sleep 1
done
echo 'Graph node is ready, deploying subgraph...'

# Ensure node_modules exists
if [ ! -d "node_modules" ]; then
    echo "node_modules directory not found. Installing dependencies..."
    npm install
fi

# Generate and build the subgraph
graph codegen
graph build

# Create the subgraph if it doesn't exist
graph create --node "$NODE_URL" "$SUBGRAPH_NAME" || true

# Deploy the subgraph
graph deploy --node "$NODE_URL" --ipfs "$IPFS_URL" "$SUBGRAPH_NAME" subgraph.yaml --version-label "$VERSION"

# Allow time for deployment
sleep 2

# Check the deployment status with a correctly formatted JSON payload
echo 'Deployment attempt completed. Checking status...'
curl -X POST "${NODE_URL}graphql" \
    -H 'Content-Type: application/json' \
    -d '{"query": "{ indexingStatuses { subgraph synced health errors { message } } }"}'
