#!/bin/sh
set -e

# Inject runtime config into env.js before nginx starts.
# SENTRY_DSN is read from the container env (K8s secret → env var).
cat > /usr/share/nginx/html/env.js << EOF
window.__SENTRY_DSN__ = "${SENTRY_DSN:-}";
EOF

exec nginx -g "daemon off;"
