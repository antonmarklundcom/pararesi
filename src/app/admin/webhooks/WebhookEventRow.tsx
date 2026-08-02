"use client";

import { useState, useTransition } from "react";
import type { WebhookEventSummary, WebhookEventStatus } from "@/lib/webhook/admin";
import { replayWebhookEventAction, getWebhookEventRawPayloadAction } from "./actions";

const STATUS_STYLES: Record<WebhookEventStatus, string> = {
  processed: "bg-brand-green-50 text-brand-green-700",
  failed: "bg-red-50 text-red-700",
  pending: "bg-amber-50 text-amber-700",
};

function StatusBadge({ status }: { status: WebhookEventStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

export function WebhookEventRow({ event }: { event: WebhookEventSummary }) {
  const [expanded, setExpanded] = useState(false);
  const [payload, setPayload] = useState<string | null>(null);
  const [payloadPending, startPayloadTransition] = useTransition();
  const [replayPending, startReplayTransition] = useTransition();
  const [replayResult, setReplayResult] = useState<string | null>(null);

  function toggleExpanded() {
    if (!expanded && payload === null) {
      startPayloadTransition(async () => {
        const raw = await getWebhookEventRawPayloadAction(event.id);
        setPayload(raw ?? "(payload not found)");
      });
    }
    setExpanded((v) => !v);
  }

  function replay() {
    setReplayResult(null);
    startReplayTransition(async () => {
      const result = await replayWebhookEventAction(event.id);
      setReplayResult(result.ok ? "Replayed successfully." : `Replay failed: ${result.error}`);
    });
  }

  return (
    <>
      <tr className="border-b border-brand-navy-900/5 last:border-0">
        <td className="px-4 py-3 text-brand-navy-900">{event.eventName}</td>
        <td className="px-4 py-3">
          <StatusBadge status={event.status} />
        </td>
        <td className="px-4 py-3 text-brand-navy-900/70">
          {event.processedAt ? new Date(event.processedAt).toLocaleString() : "—"}
        </td>
        <td className="px-4 py-3 text-brand-navy-900/70">
          {event.createdAt ? new Date(event.createdAt).toLocaleString() : "—"}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={toggleExpanded}
              className="text-sm text-brand-green-600 hover:text-brand-green-700"
            >
              {expanded ? "Hide payload" : "View payload"}
            </button>
            <button
              type="button"
              onClick={replay}
              disabled={replayPending}
              className="text-sm text-brand-navy-800 hover:text-brand-navy-900 disabled:opacity-50"
            >
              {replayPending ? "Replaying…" : "Replay"}
            </button>
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-brand-navy-900/5 last:border-0">
          <td colSpan={5} className="bg-brand-navy-950/[0.03] px-4 py-4">
            {event.error ? (
              <p className="mb-3 text-sm text-red-700">
                <span className="font-medium">Error:</span> {event.error}
              </p>
            ) : null}
            {replayResult ? (
              <p className="mb-3 text-sm text-brand-navy-900">{replayResult}</p>
            ) : null}
            <pre className="max-h-96 overflow-auto rounded-lg bg-brand-navy-950 p-4 text-xs text-white">
              {payloadPending ? "Loading…" : payload}
            </pre>
          </td>
        </tr>
      ) : null}
    </>
  );
}
