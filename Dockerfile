# Giao diện: build Vite rồi Caddy phục vụ file tĩnh.
FROM node:22-slim AS build
WORKDIR /app
COPY web/package.json web/package-lock.json web/
RUN cd web && npm ci
COPY core/src core/src
COPY web web
RUN cd web && npm run build

FROM caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/web/dist /srv
EXPOSE 80
