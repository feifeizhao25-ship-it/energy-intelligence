const apiUrl = process.env.NEXT_PUBLIC_API_URL;

const errors = [];
if (!apiUrl) errors.push('NEXT_PUBLIC_API_URL is required');
if (apiUrl && !apiUrl.startsWith('https://')) errors.push('NEXT_PUBLIC_API_URL must use HTTPS');
if (apiUrl && /localhost|127\.0\.0\.1/.test(apiUrl)) errors.push('NEXT_PUBLIC_API_URL cannot target localhost');

if (errors.length) {
  for (const error of errors) process.stderr.write(`Production environment error: ${error}\n`);
  process.exit(1);
}

process.stdout.write('Production environment validated\n');
