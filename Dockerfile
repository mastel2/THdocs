# THdocs — ติดตั้งเองบนเซิร์ฟเวอร์/เครื่องในองค์กร
#   docker build -t thdocs .
#   docker run -p 3000:3000 thdocs        (หรือใช้ docker-compose.yml)
# base ปักเป็น digest (ตรวจเมื่อ 2026-10-24) — อัปเดตเมื่อต้องการแพตช์ความปลอดภัยใหม่
FROM node:24-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/cli/package.json apps/cli/
COPY packages/core/package.json packages/core/
COPY packages/llm/package.json packages/llm/
COPY packages/render-docx/package.json packages/render-docx/
COPY packages/render-html/package.json packages/render-html/
COPY packages/templates-thgov/package.json packages/templates-thgov/
COPY packages/templates-iso/package.json packages/templates-iso/
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build -w @thdocs/web

FROM node:24-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/api/config').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
