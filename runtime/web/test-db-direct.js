const { PrismaClient } = require('@prisma/client');

// 手动构建标准的 Supabase 直连 URL
// 直连 URL 从环境变量读取，不再硬编码数据库密码
const DIRECT_URL = process.env.DIRECT_URL;
if (!DIRECT_URL) {
    console.error('DIRECT_URL is not set. Export it before running this script.');
    process.exit(1);
}

async function main() {
    const prisma = new PrismaClient({
        datasources: {
            db: {
                url: DIRECT_URL
            }
        }
    });

    try {
        console.log('Testing direct connection to db.ovvgjmclcdbxhcdzwcsj.supabase.co...');
        const userCount = await prisma.user.count();
        console.log('Success! User count:', userCount);
    } catch (error) {
        console.error('Direct connection failed:');
        console.error(error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
