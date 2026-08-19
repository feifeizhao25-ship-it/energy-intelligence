  onToken: (token: string) => void,
  onSkills: (skills: string[]) => void,
  onSources: (sources: string) => void,
  onStage: (stage: 'thinking' | 'rag' | 'skill' | 'generating' | 'done', details?: any) => void,
  onDone: () => void,
  onError: (err: string) => void,
          if (event.type === 'rag' || event.rag_sources) {
            onStage('rag', { ragCount: event.rag_sources?.length || 0 });
            if (event.rag_sources?.length) {
              const sourceText = event.rag_sources
                .map((source: any, index: number) => {
                  const title = source.title || source.name || source.source || `Source ${index + 1}`;
                  const section = source.section ? ` ${source.section}` : '';
                  const date = source.publication_date || source.last_verified || source.year || '';
                  const url = source.url ? ` — ${source.url}` : '';
                  return `[${index + 1}] ${title}${section}${date ? ` (${date})` : ''}${url}`;
                })
                .join('\n');
              onSources(sourceText);
            }
          } else if (event.type === 'skill' || event.skills) {
      (skills) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, skillsUsed: skills } : m))
        );
      },
      (sources) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, ragSources: sources } : m))
        );
      },
      // V21 P31: stage callback
      (stage, details) => {
            {msg.ragSources && (
              <div className="mt-2 pt-2 border-t border-border/10 text-[11px] leading-relaxed text-muted-foreground ml-11 whitespace-pre-wrap">
                <span className="font-semibold text-on-surface-variant">Sources:</span>{' '}
                {msg.ragSources}
              </div>
            )}
