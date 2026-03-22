"use client";

import { ReactNode } from "react";
import type React from "react";
import styles from "./responsive-table.module.css";

type Column = {
  key: string;
  label: string;
  width?: number | string;
  priority?: "high" | "medium" | "low";
};

export function ResponsiveTable(props: {
  columns: Column[];
  rows: Array<{ key: string; cells: Record<string, ReactNode> }>;
  empty?: ReactNode;
  stackBreakpointPx?: number;
  ariaLabel?: string;
}) {
  const stack = props.stackBreakpointPx ?? 720;

  if (props.rows.length === 0) {
    return <div className={styles.empty}>{props.empty ?? "暂无数据"}</div>;
  }

  return (
    <div
      className={styles.wrap}
      role="region"
      aria-label={props.ariaLabel ?? "数据表格"}
      style={{ "--stack-breakpoint": `${stack}px` } as React.CSSProperties}
    >
      <table className={styles.table}>
        <colgroup>
          {props.columns.map((col) => (
            <col key={col.key} style={col.width ? { width: col.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {props.columns.map((col) => (
              <th key={col.key}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row) => (
            <tr key={row.key}>
              {props.columns.map((col) => (
                <td key={col.key} data-label={col.label} data-priority={col.priority ?? "medium"}>
                  {row.cells[col.key] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
