#!/bin/sh
set -eu
npx prisma migrate deploy --schema=src/prisma/schema.prisma
exec node server.js
