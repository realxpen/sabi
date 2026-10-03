import { neon } from "@neondatabase/serverless";
import { missionStepSchema, type MissionStep } from "../../schemas";
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

/** Atomically patch one existing step without overwriting concurrent tool results. */
export async function updateMissionStep(step: MissionStep): Promise<void> {
  const validated = missionStepSchema.parse(step);
  const sql = getSql();
  await sql`
    update mission_snapshots
    set snapshot = jsonb_set(snapshot, '{steps}', (
      select coalesce(jsonb_agg(
        case when entry->>'id' = ${validated.id}
          then ${JSON.stringify(validated)}::jsonb else entry end
        order by ordinal
      ), '[]'::jsonb)
      from jsonb_array_elements(snapshot->'steps') with ordinality as s(entry, ordinal)
    )), updated_at = now()
    where id = ${validated.missionId}
  `;
}
