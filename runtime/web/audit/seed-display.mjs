/**
 * 为显示巡检写入五个角色的示例账号和项目。
 * 名称都带「示例」。不写入电价、发电量或已审核政策，避免把演示数当成正式数据。
 * 用法：DATABASE_URL=... node audit/seed-display.mjs
 */
import { PrismaClient } from '@prisma/client';

const people = [
    { id: 'seed-investor', role: 'investor', name: '示例·投资者', province: '山东', interest: 'solar', plan: 'PRO' },
    { id: 'seed-owner', role: 'owner', name: '示例·业主', province: '江苏', interest: 'solar', plan: 'PRO' },
    { id: 'seed-engineer', role: 'engineer', name: '示例·工程师', province: '河北', interest: 'wind', plan: 'FULL' },
    { id: 'seed-researcher', role: 'researcher', name: '示例·研究员', province: '北京', interest: 'storage', plan: 'FREE' },
    { id: 'seed-government', role: 'government', name: '示例·园区', province: '广东', interest: 'all', plan: 'TEAM' },
];

const prisma = new PrismaClient();
const expire = new Date('2027-12-31T00:00:00.000Z');

async function main() {
    for (const person of people) {
        await prisma.user.upsert({
            where: { id: person.id },
            update: { name: person.name, plan: person.plan, profileCompleted: true },
            create: {
                id: person.id,
                email: `${person.id}@seed.invalid`,
                name: person.name,
                phone: `1000000${people.indexOf(person) + 1001}`,
                plan: person.plan,
                planExpireAt: person.plan === 'FREE' ? null : expire,
                profileCompleted: true,
                termsAcceptedAt: new Date('2026-08-22T00:00:00.000Z'),
                termsVersion: '2026-08-22',
            },
        });
        await prisma.userProfile.upsert({
            where: { userId: person.id },
            update: { role: person.role, provinces: [person.province] },
            create: {
                userId: person.id,
                role: person.role,
                provinces: [person.province],
                topics: [person.interest],
                projectStage: '示例',
            },
        });
        await prisma.usageLog.deleteMany({ where: { userId: person.id, type: 'PROFILE_PREFERENCES' } });
        await prisma.usageLog.create({
            data: {
                userId: person.id,
                type: 'PROFILE_PREFERENCES',
                metadata: {
                    preferences: {
                        role: person.role,
                        province: person.province,
                        interest: person.interest,
                        personalized: true,
                        tags: [],
                    },
                },
            },
        });
        const projectId = `${person.id}-project`;
        await prisma.project.upsert({
            where: { id: projectId },
            update: { name: `示例项目·${person.province}` },
            create: {
                id: projectId,
                userId: person.id,
                name: `示例项目·${person.province}`,
                type: person.interest === 'wind' ? 'WIND' : person.interest === 'storage' ? 'STORAGE' : 'SOLAR',
                location: person.province,
                capacity: 500,
                lat: 36.6,
                lng: 117.1,
            },
        });
        await prisma.station.upsert({
            where: { id: `${person.id}-station` },
            update: {},
            create: {
                id: `${person.id}-station`,
                userId: person.id,
                projectId,
                name: `示例电站·${person.province}`,
                type: person.interest === 'wind' ? 'WIND' : 'SOLAR',
                lat: 36.6,
                lng: 117.1,
                capacity: 500,
                status: 'normal',
            },
        });
    }
    console.log(JSON.stringify(people.map((person) => person.id)));
}

main().finally(() => prisma.$disconnect());
