# Home Budget Frontend - Next.js 16
# Matches production environment on firedup.app

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install dependencies for node-gyp (some packages need it)
RUN apk add --no-cache libc6-compat

# Copy package files first (better caching)
COPY package.json package-lock.json* ./

# Install dependencies (--legacy-peer-deps for ESLint 8/9 conflict)
RUN npm ci --legacy-peer-deps

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Environment variables (can be overridden)
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1

# Default command for development
CMD ["npm", "run", "dev"]
