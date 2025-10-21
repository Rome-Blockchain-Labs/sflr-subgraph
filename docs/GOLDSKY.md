# Goldsky Deployment Guide

This document explains the requirements and steps to deploy the sflr-subgraph to
Goldsky.

## Prerequisites

### 1. Goldsky Account
- Sign up for a Goldsky account at https://goldsky.com
- Create a new project in the Goldsky dashboard
- Note your project ID (visible in the dashboard URL)

### 2. Goldsky CLI
Install the Goldsky CLI tool:
```sh
npm install -g @goldskycom/cli
# or
yarn global add @goldskycom/cli
```

### 3. API Key
- Navigate to your Goldsky dashboard
- Go to Settings → API Keys
- Generate a new API key
- Save this key securely - you'll need it for authentication

## Authentication

### Option 1: Interactive Login
```sh
goldsky login
```
This will prompt you to enter your API key.

### Option 2: Environment Variable
Set your API key as an environment variable:
```sh
export GOLDSKY_API_KEY=your_api_key_here
```

Add this to your `~/.bashrc`, `~/.zshrc`, or equivalent to persist across sessions.

## Deployment Steps

### 1. Prepare the Subgraph
```sh
# Install dependencies
yarn

# Generate types from schema
yarn codegen

# Build the subgraph
yarn build
```

### 2. Deploy to Goldsky
```sh
# Deploy with version number
goldsky subgraph deploy sflr-subgraph/0.1.5 --path .
```

Replace `0.1.5` with your target version number.

### 3. Verify Deployment
After deployment, Goldsky will provide:
- A public GraphQL endpoint URL
- Deployment status and logs

Check the deployment status:
```sh
goldsky subgraph list
```

## Current Deployment

The current production deployment is accessible at:
```
https://api.goldsky.com/api/public/project_cm8re9gott8zl01u494d0hnuu/subgraphs/sflr-subgraph/0.1.5/gn
```

## Testing the Deployment

Use the included Python script to verify entity counts:
```sh
python scripts/goldsky_entities.py
```

Or test with a GraphQL query:
```sh
curl -X POST https://api.goldsky.com/api/public/project_cm8re9gott8zl01u494d0hnuu/subgraphs/sflr-subgraph/0.1.5/gn \
  -H "Content-Type: application/json" \
  -d '{"query": "{ accounts(first: 5) { id } }"}'
```

## Troubleshooting

### Authentication Fails
- Verify your API key is correct
- Ensure no extra whitespace in the key
- Try logging out and logging in again: `goldsky logout && goldsky login`

### Build Fails
- Ensure all dependencies are installed: `yarn install`
- Run `yarn codegen` before building
- Check that your schema.graphql is valid

### Deployment Rejected
- Verify the version number is unique (can't redeploy same version)
- Check that the build completed successfully
- Ensure you have permission in the Goldsky project

## Version Management

When deploying a new version:
1. Update the version number in your deployment command
2. Deploy: `goldsky subgraph deploy sflr-subgraph/0.1.6 --path .`
3. Update the URL in `scripts/goldsky_entities.py` if needed

## Additional Resources

- Goldsky Documentation: https://docs.goldsky.com
