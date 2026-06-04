FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Remove the default nginx config that would conflict
RUN rm -f /etc/nginx/conf.d/default.conf.bak

EXPOSE 80 443
