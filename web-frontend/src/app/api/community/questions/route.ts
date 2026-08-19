import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';

// Mock data for development (replace with database queries in production)
interface Question {
    id: string;
    title: string;
    content: string;
    author: { id: string; name: string; avatar: string | null; isExpert?: boolean };
    category: string;
    tags: string[];
    createdAt: string;
    views: number;
    likes: number;
    answers: {
        id: string;
        content: string;
        author: { id: string; name: string; avatar: string | null; isExpert?: boolean };
        createdAt: string;
        likes: number;
        isBestAnswer: boolean;
    }[];
    isAnswered: boolean;
    bestAnswerId: string | null;
}

let questions: Question[] = [
    {
        id: '1',
        title: '屋顶装光伏需要什么手续？',
        content: '我家是自建房，想在屋顶装光伏发电，请问需要办理哪些手续？大概多久能装好？需要准备什么材料？',
        author: { id: 'user1', name: '阳光生活', avatar: null },
        category: 'installation',
        tags: ['光伏', '安装', '手续'],
        createdAt: new Date('2026-01-13').toISOString(),
        views: 234,
        likes: 28,
        answers: [
            {
                id: 'a1',
                content: '需要办理的手续包括：1. 向当地供电局提交并网申请；2. 准备房产证明、身份证等材料；3. 供电局现场勘测；4. 签订并网协议；5. 安装完成后验收并网。一般整个流程需要2-4周。',
                author: { id: 'expert1', name: '光伏专家张工', avatar: null, isExpert: true },
                createdAt: new Date('2026-01-14').toISOString(),
                likes: 15,
                isBestAnswer: true
            }
        ],
        isAnswered: true,
        bestAnswerId: 'a1',
    },
    {
        id: '2',
        title: '光伏板清洗多久一次比较好？',
        content: '装了半年了，发现发电量有点下降，是不是需要清洗了？自己清洗会不会损坏组件？',
        author: { id: 'user2', name: '新能源小白', avatar: null },
        category: 'maintenance',
        tags: ['光伏', '清洗', '维护'],
        createdAt: new Date('2026-01-12').toISOString(),
        views: 156,
        likes: 15,
        answers: [
            {
                id: 'a2',
                content: '一般建议每3-6个月清洗一次，具体看当地空气质量。如果发现发电量下降10%以上，建议清洗。自清洗时用软布和中性清洁剂即可，不要用高压水枪对着组件冲。',
                author: { id: 'expert2', name: '运维工程师李', avatar: null, isExpert: true },
                createdAt: new Date('2026-01-13').toISOString(),
                likes: 8,
                isBestAnswer: false
            }
        ],
        isAnswered: true,
        bestAnswerId: null,
    },
    {
        id: '3',
        title: '自发自用和全额上网哪个更划算？',
        content: '我家白天基本没人，用电量不大，是选自发自用还是全额上网？',
        author: { id: 'user3', name: '犹豫不决', avatar: null },
        category: 'policy',
        tags: ['电价', '收益', '政策'],
        createdAt: new Date('2026-01-14').toISOString(),
        views: 89,
        likes: 8,
        answers: [],
        isAnswered: false,
        bestAnswerId: null,
    },
    {
        id: '4',
        title: '分布式光伏的补贴是怎么计算的？',
        content: '听说现在补贴越来越少了，想问一下2024年的补贴政策是怎样的？',
        author: { id: 'user4', name: '关注政策', avatar: null },
        category: 'policy',
        tags: ['补贴', '政策', '收益'],
        createdAt: new Date('2026-01-15').toISOString(),
        views: 312,
        likes: 45,
        answers: [
            {
                id: 'a3',
                content: '2024年光伏补贴政策：1. 国家层面：新建光伏项目已无补贴；2. 存量项目：按原政策执行到补贴期限；3. 地方补贴：部分地区还有额外补贴，建议咨询当地发改委或供电局。收益主要来自卖电收入和节省的电费。',
                author: { id: 'expert3', name: '政策解读员', avatar: null, isExpert: true },
                createdAt: new Date('2026-01-16').toISOString(),
                likes: 32,
                isBestAnswer: true
            }
        ],
        isAnswered: true,
        bestAnswerId: 'a3',
    },
    {
        id: '5',
        title: '光伏组件选单晶硅还是多晶硅？',
        content: '市面上有单晶硅和多晶硅，价格差异大，哪个性价比更高？',
        author: { id: 'user5', name: '技术控', avatar: null },
        category: 'technology',
        tags: ['组件', '技术', '选型'],
        createdAt: new Date('2026-01-16').toISOString(),
        views: 178,
        likes: 22,
        answers: [
            {
                id: 'a4',
                content: '单晶硅效率高（20-23%）、寿命长、衰减慢，但价格贵；多晶硅效率稍低（18-20%）、价格便宜。如果预算充足且屋顶面积有限，优先选单晶硅；如果面积大追求性价比，多晶硅也是不错的选择。',
                author: { id: 'expert1', name: '光伏专家张工', avatar: null, isExpert: true },
                createdAt: new Date('2026-01-17').toISOString(),
                likes: 18,
                isBestAnswer: false
            }
        ],
        isAnswered: true,
        bestAnswerId: null,
    },
];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get('category') || 'all';
        const sortBy = searchParams.get('sort') || 'latest';
        const search = searchParams.get('search') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');

        let filtered = [...questions];

        // Filter by category
        if (category !== 'all') {
            filtered = filtered.filter(q => q.category === category);
        }

        // Search
        if (search) {
            filtered = filtered.filter(q =>
                q.title.toLowerCase().includes(search.toLowerCase()) ||
                q.content.toLowerCase().includes(search.toLowerCase())
            );
        }

        // Sort
        switch (sortBy) {
            case 'hot':
                filtered.sort((a, b) => (b.views * 2 + b.likes * 5 + b.answers.length * 3) - (a.views * 2 + a.likes * 5 + a.answers.length * 3));
                break;
            case 'unanswered':
                filtered = filtered.filter(q => !q.isAnswered);
                break;
            default: // latest
                filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        // Pagination
        const total = filtered.length;
        const start = (page - 1) * limit;
        const paginated = filtered.slice(start, start + limit);

        return NextResponse.json({
            questions: paginated.map(q => ({
                ...q,
                answers: undefined,
                answerCount: q.answers.length
            })),
            pagination: {
                page,
                limit,
                total,
                hasMore: start + limit < total
            }
        });
    } catch (error) {
        console.error('Get questions error:', error);
        return NextResponse.json({ error: '获取问题列表失败' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: '请先登录' }, { status: 401 });
        }

        const body = await request.json();
        const { title, content, category, tags } = body;

        if (!title || !content || !category) {
            return NextResponse.json({ error: '请填写完整信息' }, { status: 400 });
        }

        const newQuestion = {
            id: `q_${Date.now()}`,
            title,
            content,
            author: {
                id: (session.user as any).id || 'unknown',
                name: session.user.name || '匿名用户',
                avatar: session.user.image || null
            },
            category,
            tags: tags || [],
            createdAt: new Date().toISOString(),
            views: 0,
            likes: 0,
            answers: [],
            isAnswered: false,
            bestAnswerId: null,
        };

        questions.unshift(newQuestion);

        return NextResponse.json({
            question: {
                ...newQuestion,
                answers: undefined,
                answerCount: 0
            }
        });
    } catch (error) {
        console.error('Create question error:', error);
        return NextResponse.json({ error: '发布问题失败' }, { status: 500 });
    }
}
