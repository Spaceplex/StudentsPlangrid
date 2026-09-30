FROM oven/bun:latest

WORKDIR /app

# Copy package files and install dependencies
COPY package.json bun.lockb* ./
RUN bun install --production

# Copy application code
COPY . .

# Expose port (Render sets the PORT env variable dynamically)
EXPOSE 3000

CMD ["bun", "run", "src/index.tsx"]
