FROM nginx:alpine

# Copy frontend files
COPY . /usr/share/nginx/html/

# Remove server directory from frontend (will be in a separate container)
RUN rm -rf /usr/share/nginx/html/server

# Configure nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
