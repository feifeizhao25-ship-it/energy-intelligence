/**
 * Domestic request path never calls overseas data hosts.
 * The signature accepts the same arguments as fetch so call sites stay typed,
 * then refuses before any network I/O.
 */
export async function refuseOverseas(..._args: unknown[]): Promise<Response> {
  throw new Error('OVERSEAS_SOURCE_DISABLED');
}
