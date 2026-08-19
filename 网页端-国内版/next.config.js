const apiInternalUrl = process.env.API_INTERNAL_URL;
if (process.env.NODE_ENV === 'production' && !apiInternalUrl) {
  throw new Error('API_INTERNAL_URL is required for the production server');
}
        destination: `${apiInternalUrl || 'http://127.0.0.1:8002'}/api/:path*`,