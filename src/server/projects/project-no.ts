import { sql } from "drizzle-orm";
import type { db as dbType } from "~/server/db";
import { projects } from "~/server/db/schema";

const PROJECT_NO_SEQ_DIGITS = 3;

type Tx = Parameters<Parameters<typeof dbType.transaction>[0]>[0];

/**
 * 案件ID WW-YYYYMM-001 を採番（同一の引渡月内で連番、既存件数+1。議事録決定事項）。
 * 引渡月ごとに pg_advisory_xact_lock で排他し、COUNT→採番の間に他リクエストが
 * 割り込めないようにする。呼び出し元は db.transaction() 内で tx を渡すこと
 * （ロックはトランザクション終了まで有効）。
 */
export async function nextProjectNoTx(
  tx: Tx,
  deliveryMonth: string
): Promise<string> {
  const ym = deliveryMonth.replace("-", "");
  const prefix = `WW-${ym}-`;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${prefix}))`);
  const rows = await tx
    .select({ cnt: sql<number>`count(*)::int` })
    .from(projects)
    .where(sql`${projects.projectNo} like ${`${prefix}%`}`);
  const count = rows[0]?.cnt ?? 0;
  return prefix + String(count + 1).padStart(PROJECT_NO_SEQ_DIGITS, "0");
}
