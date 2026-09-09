# syntax=docker/dockerfile:1

# ---------- build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

COPY . .
ARG VITE_DATA_SOURCE=mock
ARG VITE_API_BASE_URL=http://localhost:8000/api/v1
ARG VITE_DATA_SCALE=standard
ENV VITE_DATA_SOURCE=$VITE_DATA_SOURCE \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_DATA_SCALE=$VITE_DATA_SCALE
RUN npm run build

# ---------- runtime stage ----------
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]
