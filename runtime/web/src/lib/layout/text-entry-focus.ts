const NON_TEXT_INPUT = new Set([
  'button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'range', 'hidden', 'image', 'color',
]);

/** 文本框、多行输入、下拉。按钮和勾选不算，避免点底栏自己时把底栏藏掉。 */
export function isTextEntryElement(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: string; type?: string };
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const type = String(el.type || 'text').toLowerCase();
  return !NON_TEXT_INPUT.has(type);
}
