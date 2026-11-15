FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src
ARG VITE_API_URL=/amber
ARG VITE_FIRMS_URL=
ENV VITE_API_URL=$VITE_API_URL VITE_FIRMS_URL=$VITE_FIRMS_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV AMBER_UPSTREAM=http://amber-api:8001 FIRMS_UPSTREAM=http://firms-server:8002
EXPOSE 80
