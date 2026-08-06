/**
 * @energy-intel/skills-sdk — typed client for the AI-engine skill runtime.
 */

export interface SkillDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
}

export interface SkillRunRequest {
  skillId: string;
  input: Record<string, unknown>;
  locale?: 'zh-CN' | 'en';
}

export interface SkillRunResult<T = unknown> {
  skillId: string;
  status: 'ok' | 'unavailable' | 'error';
  result: T | null;
  message?: string;
}

export interface SkillsClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export class SkillsClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SkillsClientOptions) {
    if (!options.baseUrl) {
      throw new Error('SkillsClient requires a baseUrl');
    }
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async listSkills(): Promise<SkillDefinition[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/skills`, {
      headers: this.headers(),
    });
    if (!response.ok) {
      throw new Error(`listSkills failed: ${response.status}`);
    }
    const payload = (await response.json()) as { skills: SkillDefinition[] };
    return payload.skills;
  }

  async runSkill<T = unknown>(
    request: SkillRunRequest,
  ): Promise<SkillRunResult<T>> {
    const response = await this.fetchImpl(
      `${this.baseUrl}/skills/${encodeURIComponent(request.skillId)}/run`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ input: request.input, locale: request.locale }),
      },
    );
    if (!response.ok) {
      throw new Error(`runSkill ${request.skillId} failed: ${response.status}`);
    }
    return (await response.json()) as SkillRunResult<T>;
  }
}

export function createSkillsClient(options: SkillsClientOptions): SkillsClient {
  return new SkillsClient(options);
}
