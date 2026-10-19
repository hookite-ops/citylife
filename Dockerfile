# 도시생활 · Cloud Run 배포용 (정적 웹 + nginx)
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html style.css /usr/share/nginx/html/
COPY js /usr/share/nginx/html/js
COPY vendor /usr/share/nginx/html/vendor
COPY sounds /usr/share/nginx/html/sounds
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
