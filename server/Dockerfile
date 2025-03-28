FROM node:16-alpine

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy server files
COPY . .

# We'll use volumes to mount data files instead of copying them
# This is handled in docker-compose.yml

# Expose the port the server runs on
EXPOSE 3000

CMD ["npm", "start"]
