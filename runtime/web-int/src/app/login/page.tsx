import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in · Energy Intelligence Global',
  description: 'Sign in to Energy Intelligence Global.',
};

export default function Login() {
  return (
    <main className="shell">
      <section className="hero">
        <div>
          <div className="eyebrow">Sign in</div>
          <h1>Sign in to your workspace.</h1>
          <p>Use the email and password for your Energy Intelligence Global account. Assessment and evidence stay open without an account.</p>
          <LoginForm />
          <p><Link href="/privacy">Privacy Policy</Link> · <Link href="/terms">Terms of Service</Link></p>
        </div>
      </section>
    </main>
  );
}
