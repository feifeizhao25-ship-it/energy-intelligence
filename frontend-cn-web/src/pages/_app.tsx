import type { AppProps } from 'next/app';
import '../styles/globals.css';
import ShellErrorBoundary from '../components/ShellErrorBoundary';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ShellErrorBoundary>
      <Component {...pageProps} />
    </ShellErrorBoundary>
  );
}
