import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty-state" style={{ minHeight: "100vh" }}>
      <h2>找不到这张脑图</h2>
      <p>它可能已被删除，或链接不正确。</p>
      <Link href="/" className="create-btn">
        返回工作台
      </Link>
    </div>
  );
}
