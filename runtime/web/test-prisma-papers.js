
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

// Try project-specific pooler host
// 连接串完全来自 .env.local，不再在源码里拼接数据库密码
if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set (expected in .env.local).');
    process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing with PROJECT POOLER:', DB_HOST);
        console.log('Testing SavedPaper query...');
        const papers = await prisma.savedPaper.findMany({
            where: { userId: 'dev-master-id' },
            include: { folder: true }
        });
        console.log('Query success, papers count:', papers.length);

    } catch (e) {
        console.error('Query failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
