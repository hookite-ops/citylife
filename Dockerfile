# 도시생활 · Cloud Run 배포용 (정적 웹 + nginx)
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html style.css /usr/share/nginx/html/
COPY js /usr/share/nginx/html/js
COPY vendor /usr/share/nginx/html/vendor
COPY sounds /usr/share/nginx/html/sounds
# 배포할 때마다 새 버전 번호를 붙여서 브라우저가 예전 파일을 쓰지 않게 함
RUN cd /usr/share/nginx/html && V=$(date +%s) && \
    MAP=$(for f in js/*.js; do printf '"./%s": "./%s?v=%s", ' "$f" "$f" "$V"; done) && \
    sed -i "s|\"./__MAP__\": \"./__MAP__\"|${MAP%, }|; s|__V__|$V|g" index.html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
