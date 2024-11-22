#!/bin/bash

# Use environment variables directly
SUBGRAPH_NAME="${SUBGRAPH_NAME:-sflr-subgraph}"
NODE_URL="${NODE_URL:-http://graph-node-sflr:8020/}"
IPFS_URL="${IPFS_URL:-http://ipfs-sflr:5001}"
VERSION="${VERSION:-0.0.7}"

echo "Deploying subgraph: $SUBGRAPH_NAME with version: $VERSION"

# Wait for Graph Node to be ready
echo 'Waiting for graph-node to be ready...'
until curl -s "$NODE_URL" > /dev/null; do
    echo "Graph node is not ready, waiting..."
    sleep 5
done
echo 'Graph node is ready, deploying subgraph...'

# Ensure node_modules exists
if [ ! -d "node_modules" ]; then
    echo "node_modules directory not found. Installing dependencies..."
    npm install
fi

# Generate and build the subgraph
npx graph codegen
npx graph build

# Create the subgraph if it doesn't exist
npx graph create --node "$NODE_URL" "$SUBGRAPH_NAME" || true

# Deploy the subgraph
npx graph deploy --node "$NODE_URL" --ipfs "$IPFS_URL" "$SUBGRAPH_NAME" subgraph.yaml --version-label "$VERSION"

# Allow time for deployment
sleep 2

# Check the deployment status with a correctly formatted JSON payload
echo 'Deployment completed. Wait for sync to complete to use. Use prometheus metrics to inspect at http://graph-node-sflr:8040/metrics...'
