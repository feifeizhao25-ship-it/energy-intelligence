/**
 * 手机号格式（中国大陆 11 位）。单独成文件：登录页是浏览器端组件，
 * 不能把带 node:crypto 的 sms-verify 一起打进前端包，否则 `next build` 直接失败。
 */
export const PHONE_PATTERN = /^1[3-9]\d{9}$/;
