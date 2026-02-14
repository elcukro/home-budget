FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build admin panel
RUN npm run build

# Expose Strapi port
EXPOSE 1337

# Start in production mode (serves pre-built admin)
CMD ["npm", "run", "start"]
