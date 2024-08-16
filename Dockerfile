# Use an official Node.js runtime as a parent image
FROM node:18

# Set the working directory in the container
WORKDIR /usr/src/app

# Initialize npm and create a default package.json
RUN npm init -y

# Install
RUN npm install

# Install any global dependencies like the Graph CLI
RUN npm install -g @graphprotocol/graph-cli

# Copy the entire project to the container's working directory
COPY . .

# Make the deploy script executable
RUN chmod +x ./deploy.sh

# Run the deploy script
CMD ["./deploy.sh"]
