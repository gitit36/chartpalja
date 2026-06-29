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

# NEXT_PUBLIC_* 는 next build 시점에 클라이언트/서버 번들로 인라인된다.
# Railway 는 서비스 변수를 docker build 의 --build-arg 로 전달하므로,
# 동일 이름의 ARG 로 받아 ENV 로 승격한 뒤 build 해야 값이 박힌다.
# (이게 없으면 전부 undefined 로 빌드 → 결제수단 전부 '활성', 카카오 공유 키 누락 등)
ARG NEXT_PUBLIC_PAYMENT_MODE
ARG NEXT_PUBLIC_PAYMENT_MOCK
ARG NEXT_PUBLIC_ACTIVE_PAYMENT_METHODS
ARG NEXT_PUBLIC_KAKAO_JS_KEY
ARG NEXT_PUBLIC_PORTONE_STORE_ID
ARG NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
ARG NEXT_PUBLIC_PADDLE_ENV
ENV NEXT_PUBLIC_PAYMENT_MODE=$NEXT_PUBLIC_PAYMENT_MODE
ENV NEXT_PUBLIC_PAYMENT_MOCK=$NEXT_PUBLIC_PAYMENT_MOCK
ENV NEXT_PUBLIC_ACTIVE_PAYMENT_METHODS=$NEXT_PUBLIC_ACTIVE_PAYMENT_METHODS
ENV NEXT_PUBLIC_KAKAO_JS_KEY=$NEXT_PUBLIC_KAKAO_JS_KEY
ENV NEXT_PUBLIC_PORTONE_STORE_ID=$NEXT_PUBLIC_PORTONE_STORE_ID
ENV NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=$NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
ENV NEXT_PUBLIC_PADDLE_ENV=$NEXT_PUBLIC_PADDLE_ENV

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV PYTHON_PATH=/app/.venv/bin/python3

EXPOSE 3000

CMD ["npm", "start"]
