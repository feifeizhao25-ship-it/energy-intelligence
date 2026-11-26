export type FetchFailure = 'unauthorized' | 'missing' | 'offline';

export function failureFromStatus(status: number): FetchFailure {
  if (status === 401) return 'unauthorized';
  if (status === 404) return 'missing';
  return 'offline';
}

export function serviceNotice(failure: FetchFailure, service: string): { title: string; description: string } {
  if (failure === 'unauthorized') {
    return {
      title: 'Please sign in',
      description: `The ${service} request was refused (401). Sign in and try again. This is not a disconnected service.`,
    };
  }
  if (failure === 'missing') {
    return {
      title: 'This address was not found',
      description: `The ${service} address returned 404. That is not the same as the service being offline.`,
    };
  }
  return {
    title: `${service} did not respond`,
    description: `The ${service} request failed before a status code came back. Retry when the network is available.`,
  };
}
