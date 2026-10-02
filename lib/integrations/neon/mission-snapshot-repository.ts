import { neon } from "@neondatabase/serverless";
import {
  missionSnapshotSchema,
  type MissionSnapshot
} from "../../mission/snapshot";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL_NOT_CONFIGURED");
  }

  return neon(databaseUrl);
}

export async function saveMissionSnapshot(
  snapshot: MissionSnapshot
): Promise<MissionSnapshot> {
  const validated = missionSnapshotSchema.parse(snapshot);
  const sql = getSql();

  await sql`
    insert into mission_snapshots (id, snapshot, created_at, updated_at)
    values (
      ${validated.mission.id},
      ${JSON.stringify(validated)}::jsonb,
      now(),
      now()
    )
    on conflict (id)
    do update set
      snapshot = excluded.snapshot,
      updated_at = now()
  `;

  return validated;
}

export async function getMissionSnapshot(
  missionId: string
): Promise<MissionSnapshot | null> {
  const sql = getSql();
  const rows = await sql`
    select snapshot
    from mission_snapshots
    where id = ${missionId}
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return missionSnapshotSchema.parse(row.snapshot);
}
