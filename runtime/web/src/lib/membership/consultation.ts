/** 口径咨询只登记，不自动通过。企业微信模板号由人工配置。 */
export function bookConsultation(topic: string) {
    const clean = topic.trim();
    if (!clean) throw new Error('请填写咨询主题');
    return {
        status: 'pending' as const,
        approved: false,
        topic: clean,
        wecom: '未配置',
        message: '已登记，等待企业微信审批。不会自动通过。',
    };
}
