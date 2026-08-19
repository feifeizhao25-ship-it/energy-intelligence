const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const user = await prisma.user.findFirst();
        console.log('User found:', user);
        if (!user) {
            const newUser = await prisma.user.create({
                data: {
                    id: 'user_123',
                    email: 'test@example.com',
                    name: 'Test User',
                    plan: 'FREE'
                }
            });
            console.log('Created test user:', newUser);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
