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
    const paper = await getPaper(params.id);
    const pdfStatus = await findBestPdf(paper);

    return (
        <div className="max-w-7xl mx-auto p-6">
            <PaperDetailView paper={paper} pdfStatus={pdfStatus} />
        </div>
    );
}
