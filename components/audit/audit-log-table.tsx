"use client";

import { useMemo, useState } from "react";

type AuditEvent = {
  id: string;
  timestamp: string;
  timestampRaw: string;
  category: string;
  action: string;
  resourceType: string;
  resource: string;
  detail: string;
  actor: string;
  status: string;
};

export function AuditLogTable({ events }: { events: AuditEvent[] }) {
  const [category, setCategory] = useState("all");
  const [action, setAction] = useState("all");
  const [resourceType, setResourceType] = useState("all");
  const [actor, setActor] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");

  const categories = useMemo(() => ["all", ...new Set(events.map((e) => e.category))], [events]);
  const actions = useMemo(() => ["all", ...new Set(events.map((e) => e.action))], [events]);
  const resourceTypes = useMemo(() => ["all", ...new Set(events.map((e) => e.resourceType))], [events]);
  const actors = useMemo(() => ["all", ...new Set(events.map((e) => e.actor))], [events]);
  const statuses = useMemo(() => ["all", ...new Set(events.map((e) => e.status))], [events]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return events.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (action !== "all" && e.action !== action) return false;
      if (resourceType !== "all" && e.resourceType !== resourceType) return false;
      if (actor !== "all" && e.actor !== actor) return false;
      if (status !== "all" && e.status !== status) return false;
      if (!q) return true;
      return (
        e.timestamp.toLowerCase().includes(q) ||
        e.timestampRaw.toLowerCase().includes(q) ||
        e.resource.toLowerCase().includes(q) ||
        e.resourceType.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        e.status.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    });
  }, [events, category, action, resourceType, actor, status, query]);

  return (
    <div className="app-panel p-5">
      <div className="grid gap-3 lg:grid-cols-6">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm">
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All categories" : c}
            </option>
          ))}
        </select>

        <select value={action} onChange={(e) => setAction(e.target.value)} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm">
          {actions.map((a) => (
            <option key={a} value={a}>
              {a === "all" ? "All actions" : a}
            </option>
          ))}
        </select>

        <select
          value={resourceType}
          onChange={(e) => setResourceType(e.target.value)}
          className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
        >
          {resourceTypes.map((r) => (
            <option key={r} value={r}>
              {r === "all" ? "All resource types" : r}
            </option>
          ))}
        </select>

        <select value={actor} onChange={(e) => setActor(e.target.value)} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm">
          {actors.map((a) => (
            <option key={a} value={a}>
              {a === "all" ? "All actors" : a}
            </option>
          ))}
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm">
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : s}
            </option>
          ))}
        </select>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search log"
          className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-[#E5E7EB]">
        <table className="min-w-full divide-y divide-[#E5E7EB] text-sm">
          <thead className="bg-[#F9FAFB] text-left text-xs font-bold uppercase tracking-wide text-[#6B7280]">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Resource Type</th>
              <th className="px-3 py-2">Resource</th>
              <th className="px-3 py-2">Detail</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB] bg-white text-[#111827]">
            {filtered.length ? (
              filtered.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-[#6B7280]">{row.timestamp}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.category}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.action}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.resourceType}</td>
                  <td className="px-3 py-2">{row.resource}</td>
                  <td className="px-3 py-2 text-[#6B7280]">{row.detail}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.actor}</td>
                  <td className="whitespace-nowrap px-3 py-2">{row.status}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-[#6B7280]">
                  No audit events match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
