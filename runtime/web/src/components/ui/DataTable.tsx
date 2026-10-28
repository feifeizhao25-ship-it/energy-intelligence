'use client';

import { useMemo, useState } from 'react';

export interface TableColumn {
    key: string;
    label: string;
}

/** 超过 6 行先折叠。排序、筛选和导出都在本地完成。 */
export function DataTable({
    columns,
    rows,
    csvEnabled = false,
}: {
    columns: TableColumn[];
    rows: Record<string, string>[];
    csvEnabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [sortKey, setSortKey] = useState(columns[0]?.key ?? '');
    const [ascending, setAscending] = useState(true);
    const [scrollTop, setScrollTop] = useState(0);
    const filtered = useMemo(() => {
        const needle = query.trim();
        const matched = needle
            ? rows.filter((row) => columns.some((column) => (row[column.key] || '').includes(needle)))
            : rows;
        return [...matched].sort((a, b) => {
            const left = a[sortKey] || '';
            const right = b[sortKey] || '';
            const order = left.localeCompare(right, 'zh');
            return ascending ? order : -order;
        });
    }, [rows, columns, query, sortKey, ascending]);
    const collapsed = open ? filtered : filtered.slice(0, 6);
    const rowHeight = 32;
    const windowHeight = 240;
    const virtual = open && filtered.length > 12;
    const start = virtual ? Math.max(0, Math.floor(scrollTop / rowHeight) - 2) : 0;
    const visibleCount = Math.ceil(windowHeight / rowHeight) + 4;
    const visible = virtual ? filtered.slice(start, start + visibleCount) : collapsed;

    function download() {
        const header = columns.map((column) => column.label).join(',');
        const body = filtered.map((row) => columns.map((column) => row[column.key] || '').join(',')).join('\n');
        const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = '表格.csv';
        link.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div data-testid="data-table">
            <label className="mb-2 block text-xs text-[var(--ink-soft)]">
                筛选
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="ml-2 rounded-lg border border-[var(--line)] px-2 py-1"
                />
            </label>
            <div
                className={virtual ? 'max-w-full overflow-auto' : 'max-w-full overflow-x-auto'}
                style={virtual ? { maxHeight: windowHeight } : undefined}
                onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            >
            {virtual ? <div style={{ height: start * rowHeight }} /> : null}
            <table className="ei-table">
                <thead>
                    <tr>
                        {columns.map((column) => (
                            <th key={column.key}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (sortKey === column.key) setAscending((value) => !value);
                                        else {
                                            setSortKey(column.key);
                                            setAscending(true);
                                        }
                                    }}
                                >
                                    {column.label}
                                </button>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {visible.map((row, index) => (
                        <tr key={`${row[columns[0]?.key] ?? ''}-${index}`} data-testid="table-row">
                            {columns.map((column) => (
                                <td key={column.key}>{row[column.key]}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {virtual ? <div style={{ height: Math.max(0, (filtered.length - start - visible.length) * rowHeight) }} /> : null}
            </div>
            <p className="mt-1 text-xs text-[var(--ink-soft)]">{virtual ? `共 ${filtered.length} 行，窗口内 ${visible.length} 行` : `当前显示 ${visible.length} 行`}</p>
            {filtered.length > 6 ? (
                <button type="button" className="mt-2 text-sm underline" onClick={() => setOpen((value) => !value)}>
                    {open ? '收起' : '展开更多'}
                </button>
            ) : null}
            {csvEnabled ? (
                <button type="button" className="mt-2 block text-sm underline" onClick={download}>下载表格</button>
            ) : (
                <p className="mt-2 text-xs text-[var(--ink-soft)]">当前档位不能导出表格</p>
            )}
        </div>
    );
}
