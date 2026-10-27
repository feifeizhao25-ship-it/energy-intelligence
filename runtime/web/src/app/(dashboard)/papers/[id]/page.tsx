import { getPaper } from '@/lib/api/semantic-scholar';
import { findBestPdf } from '@/lib/papers/pdf';
import PaperDetailView from '@/components/papers/PaperDetailView';

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function PaperDetailPage(props: PageProps) {
    const params = await props.params;
    try {
        const paper = await getPaper(params.id);
        const pdfStatus = await findBestPdf(paper);
        return (
            <div className="max-w-7xl mx-auto p-6">
                <PaperDetailView paper={paper} pdfStatus={pdfStatus} />
            </div>
        );
    } catch {
        return (
            <main className="mx-auto max-w-3xl space-y-3 p-6">
                <h1 className="text-2xl font-bold">这篇文献打不开</h1>
                <p>这个编号没有对应的已收录文献。境外文献接口未启用，页面不展示替代记录。</p>
            </main>
        );
    }
}
