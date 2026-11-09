#!/bin/sh
set -e

# Inject runtime config into env.js before nginx starts.
# SENTRY_DSN is read from the container env (K8s secret → env var).
cat > /usr/share/nginx/html/env.js << EOF
window.__SENTRY_DSN__ = "${SENTRY_DSN:-}";
EOF

# Port of the backend *Service* (80 in kubernetes.yaml); set 8000 when pointing at the
# uvicorn container directly.
export BACKEND_PORT="${BACKEND_PORT:-80}"

# Process the nginx config template (substitutes ${BACKEND_HOST} and ${BACKEND_PORT}).
# The official nginx entrypoint normally does this, but we replace it.
envsubst '${BACKEND_HOST} ${BACKEND_PORT}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

exec nginx -g "daemon off;"
