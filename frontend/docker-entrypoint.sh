#!/bin/sh
set -e

# Inject runtime config into env.js before nginx starts.
# SENTRY_DSN is read from the container env (K8s secret → env var).
cat > /usr/share/nginx/html/env.js << EOF
window.__SENTRY_DSN__ = "${SENTRY_DSN:-}";
EOF

# Process the nginx config template (substitutes ${BACKEND_HOST} etc.).
# The official nginx entrypoint normally does this, but we replace it.
envsubst '${BACKEND_HOST}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
