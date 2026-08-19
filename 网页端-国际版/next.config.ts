const apiInternalUrl = process.env['API_INTERNAL_URL'];
if (process.env['NODE_ENV'] === 'production' && !apiInternalUrl) {
