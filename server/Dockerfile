FROM node:16-alpine

WORKDIR /usr/src/app

# Create directories
RUN mkdir -p /usr/src/app/data

# Copy package.json and package-lock.json
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy server files
COPY . .

# Expose the port the server runs on
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
