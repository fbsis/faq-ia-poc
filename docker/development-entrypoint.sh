#!/bin/sh

set -eu

CI=true pnpm install --frozen-lockfile --store-dir /pnpm/store
exec "$@"
