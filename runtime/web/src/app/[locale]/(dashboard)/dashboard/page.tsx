// next-intl 中间件（localePrefix: 'never'）会把 /dashboard 内部重写到 /{locale}/dashboard，
// 实际服务该路由的是本文件。实现统一收敛到 app/(dashboard)/dashboard/page.tsx，
// 这里只做转发，避免两份 dashboard 再分叉。
export { default } from '@/app/(dashboard)/dashboard/page';
