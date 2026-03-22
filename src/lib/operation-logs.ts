import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { OperationLog, OperationLogLevel } from "@/lib/types";

function now() {
  return new Date().toISOString();
}

function mapRow(row: Record<string, unknown>): OperationLog {
  return {
    id: String(row.id),
    resourceType: String(row.resource_type),
    resourceId: row.resource_id ? String(row.resource_id) : null,
    action: String(row.action),
    level: row.level as OperationLogLevel,
    message: String(row.message),
    details: row.details ? String(row.details) : null,
    createdAt: String(row.created_at),
  };
}

export function appendOperationLog(input: {
  resourceType: string;
  resourceId?: string | null;
  action: string;
  level?: OperationLogLevel;
  message: string;
  details?: unknown;
}) {
  const db = getDb();
  const item: OperationLog = {
    id: randomUUID(),
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    action: input.action,
    level: input.level ?? "info",
    message: input.message,
    details: input.details === undefined ? null : JSON.stringify(input.details),
    createdAt: now(),
  };

  db.prepare(`
    INSERT INTO operation_logs (id, resource_type, resource_id, action, level, message, details, created_at)
    VALUES (@id, @resourceType, @resourceId, @action, @level, @message, @details, @createdAt)
  `).run(item);

  db.prepare(`
    DELETE FROM operation_logs
    WHERE id NOT IN (
      SELECT id FROM operation_logs ORDER BY created_at DESC LIMIT 300
    )
  `).run();

  return item;
}

export function listOperationLogs(limit = 50): OperationLog[] {
  const rows = getDb().prepare(`
    SELECT * FROM operation_logs
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as Array<Record<string, unknown>>;

  return rows.map(mapRow);
}
