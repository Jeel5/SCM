FROM node:20-alpine

WORKDIR /app

# Install PM2 globally — used in production for cluster mode
RUN npm install -g pm2

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Ensure logs directory exists for PM2
RUN mkdir -p logs

EXPOSE 3001

# Use pm2-runtime (container-safe: no daemon, handles SIGTERM/SIGINT)
CMD ["pm2-runtime", "ecosystem.config.cjs", "--env", "production"]
