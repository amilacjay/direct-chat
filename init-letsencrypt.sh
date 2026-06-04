#!/bin/bash
# One-time Let's Encrypt bootstrap for the dockerised nginx reverse proxy.
# Run this ONCE on the server after DNS points at it. Renewals are automatic
# afterwards (the certbot service in docker-compose.prod.yml).
#
#   1. Edit the three variables below.
#   2. chmod +x init-letsencrypt.sh && ./init-letsencrypt.sh
set -e

# ======================= EDIT THESE =======================
domains=(example.com www.example.com)   # your domain(s); first one is primary
email="you@example.com"                  # for urgent cert expiry / renewal notices
staging=0                                # set to 1 to test against LE staging (avoids rate limits)
# ==========================================================

cert_name="app"          # must match the path in nginx/nginx.ssl.conf
data_path="./certbot"
rsa_key_size=4096
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: 'docker compose' is required." >&2
  exit 1
fi

# Create a throwaway self-signed cert so nginx can start and serve the challenge.
echo "### Creating dummy certificate for '$cert_name' ..."
mkdir -p "$data_path/conf/live/$cert_name"
$COMPOSE run --rm --entrypoint sh certbot -c "\
  openssl req -x509 -nodes -newkey rsa:1024 -days 1 \
    -keyout /etc/letsencrypt/live/$cert_name/privkey.pem \
    -out /etc/letsencrypt/live/$cert_name/fullchain.pem \
    -subj /CN=localhost"

echo "### Starting nginx ..."
$COMPOSE up -d nginx

echo "### Removing dummy certificate ..."
$COMPOSE run --rm --entrypoint sh certbot -c "\
  rm -Rf /etc/letsencrypt/live/$cert_name \
         /etc/letsencrypt/archive/$cert_name \
         /etc/letsencrypt/renewal/$cert_name.conf"

echo "### Requesting Let's Encrypt certificate ..."
domain_args=""
for d in "${domains[@]}"; do domain_args="$domain_args -d $d"; done
staging_arg=""; [ "$staging" != "0" ] && staging_arg="--staging"

$COMPOSE run --rm --entrypoint sh certbot -c "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg $domain_args \
    --cert-name $cert_name \
    --email $email \
    --rsa-key-size $rsa_key_size \
    --agree-tos --no-eff-email --force-renewal"

echo "### Reloading nginx ..."
$COMPOSE exec nginx nginx -s reload

echo "### Done. Bring up the full stack with:"
echo "    $COMPOSE up -d"
