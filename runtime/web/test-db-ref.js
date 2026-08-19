const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            // 从环境变量读取，不再硬编码数据库密码
            url: process.env.DATABASE_URL
        },
    },
});

async function main() {
    try {
        console.log('Testing pooler with project ref username...');
        const userCount = await prisma.user.count();
        console.log('Connection successful! User count:', userCount);
    } catch (error) {
        console.error('Connection failed:');
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
