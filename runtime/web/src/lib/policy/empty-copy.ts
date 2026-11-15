/** 政策区没有已审核条目时的说明。不编造、不预置政策。 */
export function policyLibraryEmptyCopy(input: { province?: string | null; filtered?: boolean } = {}): { title: string; detail: string } {
    if (input.filtered) {
        return {
            title: '没有符合条件的已审核政策',
            detail: '下一步：换一个关键词或日期后再查。这里只列出审核通过的原文，不会编造政策。',
        };
    }
    const where = input.province?.trim();
    if (where) {
        return {
            title: `${where}还没有已审核政策`,
            detail: `政策库里暂时没有${where}审核通过的政策。下一步：先看已公布电价，或打开政策检索。审核通过后才会出现在这里，不会用示例填满。`,
        };
    }
    return {
        title: '还没有已审核政策',
        detail: '政策库里暂时没有可展示的已审核政策。下一步：打开政策检索，或先看已公布电价。这里不会编造或预置政策。',
    };
}
