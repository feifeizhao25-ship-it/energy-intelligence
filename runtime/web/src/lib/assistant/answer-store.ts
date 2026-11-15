import { randomUUID } from 'crypto';

export interface StoredSource {
  title: string;
  url?: string;
  publisher?: string;
  issuer?: string;
  published_at?: string;
  publish_date?: string;
  date_kind?: string;
  sign_date?: string;
  effective_date?: string;
  effective_date_stated?: boolean;
  effective_date_basis?: string;
  expiry_date?: string;
  superseded_by?: string;
  primary_checked_at?: string;
  locator?: string;
  excerpt?: string;
  freshness_status?: string;
  evidence_status?: string;
  status?: string;
  license?: string;
  note?: string;
}

export interface StoredAnswer {
  id: string;
  userId: string;
  text: string;
  sources: StoredSource[];
  standIn: boolean;
  synthetic: boolean;
  createdAt: number;
}

const answers = new Map<string, StoredAnswer>();
const MAX_ANSWERS = 200;

export function saveAnswer(input: Omit<StoredAnswer, 'id' | 'createdAt'>): StoredAnswer {
  const record: StoredAnswer = { ...input, id: randomUUID(), createdAt: Date.now(), sources: input.sources.slice(0, 20) };
  answers.set(record.id, record);
  while (answers.size > MAX_ANSWERS) {
    const oldest = answers.keys().next().value;
    if (!oldest) break;
    answers.delete(oldest);
  }
  return record;
}

export function readAnswer(id: string): StoredAnswer | undefined {
  return answers.get(id);
}

export function clearAnswers(): void {
  answers.clear();
}
