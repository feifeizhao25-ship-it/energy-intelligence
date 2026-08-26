'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ThumbsUp, Check, Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Question {
  id: string;
  title: string;
  content: string;
  category: string;
  author: {
    name: string;
  };
  views: number;
  likes: number;
  isAnswered: boolean;
  createdAt: string;
  tags: string[];
}

interface Answer {
  id: string;
  content: string;
  author: {
    name: string;
    isExpert?: boolean;
  };
  likes: number;
  isBest: boolean;
  createdAt: string;
}

export function QuestionDetail({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [answerContent, setAnswerContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchQuestion();
  }, [questionId]);

  const fetchQuestion = async () => {
    try {
      const response = await fetch(`/api/community/questions/${questionId}`);
      if (response.ok) {
        const data = await response.json();
        setQuestion(data.question);
        setAnswers(data.answers);
      }
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!answerContent.trim()) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/community/questions/${questionId}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: answerContent }),
      });
      if (response.ok) {
        const data = await response.json();
        setAnswers([...answers, data.answer]);
        setAnswerContent('');
      }
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-medium text-gray-900 mb-2">问题不存在</h2>
          <Button onClick={() => router.push('/community')}>返回社区</Button>
        </div>
      </div>
    );
  }

  const getCategoryName = (cat: string) => {
    const map: Record<string, string> = {
      installation: '安装施工',
      maintenance: '运维检修',
      policy: '政策补贴',
      investment: '投资收益',
      technology: '技术讨论',
    };
    return map[cat] || cat;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/community')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回</span>
          </button>
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <Share2 className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-6 mb-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <span className="px-3 py-1 bg-primary-50 text-primary-700 text-sm rounded-full">
              {getCategoryName(question.category)}
            </span>
            {question.isAnswered && (
              <span className="px-3 py-1 bg-green-50 text-green-700 text-sm rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" />
                已解决
              </span>
            )}
          </div>

          <h1 className="text-xl font-bold text-gray-900 mb-4">{question.title}</h1>

          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-primary-600 font-medium">
                {question.author.name[0]}
              </span>
            </div>
            <div>
              <div className="font-medium text-gray-900">{question.author.name}</div>
              <div className="text-xs text-gray-500">
                {new Date(question.createdAt).toLocaleDateString('zh-CN')} ·
                {question.views} 次浏览
              </div>
            </div>
          </div>

          <div className="prose prose-sm max-w-none text-gray-700 mb-4">
            {question.content}
          </div>

          <div className="flex flex-wrap gap-2">
            {question.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            {answers.length} 个回答
          </h2>

          <div className="space-y-4">
            {answers.map((answer, index) => (
              <motion.div
                key={answer.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={cn(
                  'bg-white rounded-xl p-6',
                  answer.isBest && 'border-2 border-green-200 bg-green-50/30'
                )}
              >
                {answer.isBest && (
                  <div className="flex items-center gap-1 text-green-600 text-sm font-medium mb-3">
                    <Check className="w-4 h-4" />
                    最佳回答
                  </div>
                )}

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-gray-600 text-sm">{answer.author.name[0]}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{answer.author.name}</span>
                    {answer.author.isExpert && (
                      <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
                        专家
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-gray-700 mb-3">{answer.content}</div>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <button className="flex items-center gap-1 hover:text-gray-700">
                    <ThumbsUp className="w-4 h-4" />
                    {answer.likes}
                  </button>
                  <span>{new Date(answer.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6">
          <h3 className="font-bold text-gray-900 mb-4">写回答</h3>
          <textarea
            value={answerContent}
            onChange={(e) => setAnswerContent(e.target.value)}
            placeholder="分享你的专业知识和经验..."
            rows={4}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none resize-none mb-4"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSubmitAnswer}
              disabled={!answerContent.trim() || isSubmitting}
            >
              {isSubmitting ? '提交中...' : '提交回答'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
