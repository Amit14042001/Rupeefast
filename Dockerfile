# ──────────────────────────────────────────────
# RupeeFast — Backend Dockerfile
# ──────────────────────────────────────────────
FROM node:22-slim

WORKDIR /app

# ── Install backend dependencies (including PM2) ──
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm ci --omit=dev

# ── Copy backend source + PM2 config ──
COPY backend/src/ ./backend/src/
COPY backend/ecosystem.config.js ./backend/

# ── Copy all frontend assets, then regenerate index.html from partials ──
COPY app/src/main/assets/ ./app/src/main/assets/
RUN node app/src/main/assets/build-html.js && \
    rm -rf \
      app/src/main/assets/build-html.js \
      app/src/main/assets/package.json \
      app/src/main/assets/package-lock.json \
      app/src/main/assets/html/

# Expose application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Create logs directory for PM2
RUN mkdir -p backend/logs

# Start the server with PM2 in runtime mode (container-optimized)
# pm2-runtime handles PID 1 responsibilities and graceful shutdown in Docker.
# --only runs a single process (Docker's job is to manage the container, PM2 manages the app).
CMD ["npx", "pm2-runtime", "backend/ecosystem.config.js"]
