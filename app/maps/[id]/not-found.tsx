import Link from "next/link";

export default function NotFound() {
  return (
    <div className="empty-state" style={{ minHeight: "100vh" }}>
      <h2>Map not found</h2>
      <p>It may have been deleted, or the link is incorrect.</p>
      <Link href="/" className="create-btn">
        Back to workspace
      </Link>
    </div>
  );
}
