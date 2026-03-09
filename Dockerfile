FROM node:18-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip python3-venv openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN python3 -m venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

COPY python_service/requirements.txt python_service/requirements.txt
RUN pip install --no-cache-dir -r python_service/requirements.txt

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV PYTHON_PATH=/app/.venv/bin/python3

EXPOSE 3000

CMD ["npm", "start"]
