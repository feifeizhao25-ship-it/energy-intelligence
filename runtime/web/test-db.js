const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing connection...');
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
