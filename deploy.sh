#!/bin/bash

# Use environment variables directly
SUBGRAPH_NAME="${SUBGRAPH_NAME:-sflr-subgraph}"
NODE_URL="${NODE_URL:-http://graph-node-sflr:8020/}"
IPFS_URL="${IPFS_URL:-http://ipfs-sflr:5001}"
VERSION="${VERSION:-0.1.7}"

echo "Deploying subgraph: $SUBGRAPH_NAME with version: $VERSION"

# Wait for Graph Node to be ready
echo 'Waiting for graph-node to be ready...'
until curl -s "$NODE_URL" > /dev/null; do
    echo "Graph node is not ready, waiting..."
    sleep 5
done
echo 'Graph node is ready.'

# Check if subgraph is already deployed via the indexing-status endpoint
# (port 8030). That endpoint reports any registered deployment immediately,
# without depending on the per-subgraph runner being warm yet — which avoids
# the race where graph-node has just restarted, port 8020 is up, but the
# runner hasn't loaded sgd1's assignment yet.
STATUS_URL=$(echo "$NODE_URL" | sed 's|:8020/$|:8030/graphql|')
EXISTS_QUERY='{"query":"{indexingStatusForCurrentVersion(subgraphName:\"'"$SUBGRAPH_NAME"'\"){subgraph chains{latestBlock{number}}}}"}'

EXISTS=""
echo "Checking for existing deployment of $SUBGRAPH_NAME (up to ~3 minutes)..."
for i in $(seq 1 36); do
    RESP=$(curl -sf -X POST -H "Content-Type: application/json" -d "$EXISTS_QUERY" "$STATUS_URL" 2>/dev/null)
    # If the named subgraph exists, the response carries its deployment hash.
    if echo "$RESP" | grep -q '"subgraph":"Qm'; then
        BLOCK=$(echo "$RESP" | grep -oE '"number":"[0-9]+"' | head -1 | grep -oE '[0-9]+')
        EXISTS=1
        echo "Subgraph already deployed${BLOCK:+ (latest block $BLOCK)}. Skipping deploy."
        break
    fi
    sleep 5
done

if [ -n "$EXISTS" ] && [ "$FORCE_DEPLOY" != "true" ]; then
    exit 0
fi
if [ -n "$EXISTS" ]; then
    echo "FORCE_DEPLOY=true set, proceeding with deploy (will replace existing)..."
fi

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

echo 'Deployment completed. Wait for sync to complete to use. Use prometheus metrics to inspect at http://graph-node-sflr:8040/metrics...'
