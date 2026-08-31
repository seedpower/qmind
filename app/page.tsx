import QMindMark from "@/components/brand/QMindMark";
import CreateMapButton from "@/components/dashboard/CreateMapButton";
import MapCard from "@/components/dashboard/MapCard";
import { listMaps } from "@/lib/maps";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let maps: Awaited<ReturnType<typeof listMaps>> = [];
  let error: string | null = null;

  try {
    maps = await listMaps();
  } catch {
    error = "无法连接 MongoDB，请确认本地数据库已启动。";
  }

  return (
    <div className="home">
      <header className="home-header">
        <div>
          <p className="eyebrow">workspace</p>
          <div className="brand-lockup">
            <QMindMark size={52} />
            <h1>QMind</h1>
          </div>
          <p className="lede">把想法铺开。拖一条线，长出下一层。</p>
        </div>
        <CreateMapButton />
      </header>

      {error ? (
        <div className="empty-state error">
          <p>{error}</p>
        </div>
      ) : maps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-constellation" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <h2>还没有脑图</h2>
          <p>从中心主题开始，把分支拖到空白处即可生长。</p>
          <CreateMapButton />
        </div>
      ) : (
        <section className="map-grid">
          {maps.map((map) => (
            <MapCard key={map.id} map={map} />
          ))}
        </section>
      )}
    </div>
  );
}
