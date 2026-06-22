FROM node:24-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run prisma:generate -w apps/api
RUN npm run build -w apps/api

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/scripts ./apps/api/scripts
COPY docker/api/entrypoint.sh ./docker/api/entrypoint.sh
RUN chmod +x ./docker/api/entrypoint.sh
EXPOSE 4000
ENTRYPOINT ["./docker/api/entrypoint.sh"]
CMD ["npm", "run", "start", "-w", "apps/api"]
