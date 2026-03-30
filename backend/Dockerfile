# Backend Development Dockerfile

FROM node:20-slim

# Install build tools and OpenSSL for Prisma & native modules
RUN apt-get update && apt-get install -y openssl python3 make g++ build-essential && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy env file first
COPY .env ./

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and rebuild native modules
RUN npm install --ignore-scripts && \
    npx prisma generate && \
    npm rebuild bcrypt

# Copy source code
COPY . .

EXPOSE 3000

# Wait for postgres, run migrations, then start dev server
CMD ["sh", "-c", "sleep 5 && npx prisma migrate deploy && npm run dev"]
