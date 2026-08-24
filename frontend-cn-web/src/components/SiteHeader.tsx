import Link from 'next/link';

export default function SiteHeader() {
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="brandMark">能</span>
        <span>新能源智库</span>
      </Link>
      <nav className="nav" aria-label="主导航">
        <Link href="/">今日决策</Link>
        <Link href="/experience-week">我的一周</Link>
        <Link href="/ai">AI 问答</Link>
      </nav>
      <div className="profile"><span>专业会员</span><span className="avatar">林</span></div>
    </header>
  );
}
