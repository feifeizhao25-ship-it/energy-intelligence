const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
console.log('Available models:', Object.keys(prisma).filter(k => typeof prisma[k] === 'object' && prisma[k] !== null && !k.startsWith('_')));
process.exit(0);
