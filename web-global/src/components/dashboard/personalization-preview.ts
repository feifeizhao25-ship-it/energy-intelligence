const DEFAULT_PERSONA = 'john_smith';
const ALLOWED_PERSONAS = new Set(['john_smith', 'sarah_miller']);

export function resolvePersonaDay(
  searchParams: Pick<URLSearchParams, 'get'> | null,
): { persona: string; day: number } {
  const requestedPersona = searchParams?.get('persona');
  const persona = requestedPersona && ALLOWED_PERSONAS.has(requestedPersona)
    ? requestedPersona
    : DEFAULT_PERSONA;
  const parsed = parseInt(searchParams?.get('day') || '', 10);
  const day = parsed >= 1 && parsed <= 7 ? parsed : 1;
  return { persona, day };
}
