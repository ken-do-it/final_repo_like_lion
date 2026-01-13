# 1. Build 단계
FROM node:22-alpine as build
WORKDIR /app

# docker-compose에서 보낸 args를 받음
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_API_BASE_URL
ARG VITE_SEARCH_API_URL
ARG VITE_PLACES_API_URL

# 받은 args를 환경변수로 설정 (Vite 빌드 시 사용)
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SEARCH_API_URL=$VITE_SEARCH_API_URL
ENV VITE_PLACES_API_URL=$VITE_PLACES_API_URL
# ---------------------
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# 2. Production 단계
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]