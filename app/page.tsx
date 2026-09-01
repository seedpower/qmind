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
    error = "Could not connect to MongoDB. Make sure the local database is running.";
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
          <p className="lede">Lay ideas out. Drag a line, grow the next layer.</p>
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
          <h2>No maps yet</h2>
          <p>Start from a central topic, then drag a branch onto empty space to grow it.</p>
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
