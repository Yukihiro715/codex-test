import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import type { ClickDecision, OutboundPlacement, ReportType } from '@worklens/domain';

/**
 * M0の記録はプロセス内メモリだけ（外部analytics・DBへの送信なし）。
 * 自由記述・連絡先などの機微情報は記録しない。
 */
export interface OutboundEvent extends ClickDecision {
  at: string;
  jobId: string;
  listingId: string;
  placement: OutboundPlacement;
}

export interface ReportReceipt {
  receiptId: string;
  at: string;
  type: ReportType;
  jobId: string | null;
  wantsReply: boolean;
}

const MAX_EVENTS = 500;
const outboundEvents: OutboundEvent[] = [];
const reportReceipts: ReportReceipt[] = [];

function push<T>(list: T[], item: T): void {
  list.unshift(item);
  if (list.length > MAX_EVENTS) list.length = MAX_EVENTS;
}

/**
 * 外部遷移の記録。GETリンク（/out）は課金しない（BILL01）。ENABLE_BILLING=false の間は常に billable=false。
 */
export function recordOutbound(input: { jobId: string; listingId: string; placement: OutboundPlacement; destination: string; at: Date }): OutboundEvent {
  const event: OutboundEvent = {
    eventId: randomUUID(),
    billable: false,
    cpcJpy: 0,
    reason: input.placement === 'pr' ? 'test' : 'free',
    destination: input.destination,
    at: input.at.toISOString(),
    jobId: input.jobId,
    listingId: input.listingId,
    placement: input.placement,
  };
  push(outboundEvents, event);
  return event;
}

const RECEIPT_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 受付番号（例：RPT-20260929-7K3QXM）。推測されにくいランダム部分を含める */
export function createReceiptId(now: Date): string {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const bytes = randomBytes(6);
  const suffix = [...bytes].map((b) => RECEIPT_ALPHABET[b % RECEIPT_ALPHABET.length]).join('');
  return `RPT-${date}-${suffix}`;
}

export function recordReport(receipt: ReportReceipt): void {
  push(reportReceipts, receipt);
}

export function recentOutboundEvents(): readonly OutboundEvent[] {
  return outboundEvents;
}
