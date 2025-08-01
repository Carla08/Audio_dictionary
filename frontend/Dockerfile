# ───── STAGE 1: Build ─────
FROM node:20 AS builder

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy all other frontend source code
COPY . .
COPY .env .env

# Build static files
RUN npm run build

# ───── STAGE 2: Production Server (using nginx) ─────
FROM nginx:alpine AS runner

# Remove default nginx config and replace it
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d

# Copy built frontend files
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port nginx will run on
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
