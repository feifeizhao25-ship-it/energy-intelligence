-- user_profiles.updatedAt 在建表时写了 DEFAULT CURRENT_TIMESTAMP，
-- schema 里这一列是 @updatedAt：由 Prisma Client 写入，数据库没有默认值。
-- prisma migrate diff（migrations → schema）只差这一处。
ALTER TABLE "user_profiles" ALTER COLUMN "updatedAt" DROP DEFAULT;
