import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { getDatabase } from "./db";

export type SupportTicketStatus = "open" | "closed";
export type SupportTicketListFilter = SupportTicketStatus | "all";

export interface SupportTicket {
  id: number;
  ticketNumber: string;
  telegramUserId: number;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  messageText: string | null;
  photoFileId: string | null;
  status: string;
  createdAt: string;
  closedAt: string | null;
}

export interface SupportReply {
  id: number;
  ticketId: number;
  messageText: string | null;
  photoFileId: string | null;
  createdAt: string;
}

export interface CreateSupportTicketInput {
  telegramUserId: number;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  messageText?: string | null;
  photoFileId?: string | null;
}

export interface CreateSupportReplyInput {
  ticketId: number;
  messageText?: string | null;
  photoFileId?: string | null;
}

interface SupportTicketRow {
  id: number;
  ticket_number: string | null;
  telegram_user_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  message_text: string | null;
  photo_file_id: string | null;
  status: string;
  created_at: string;
  closed_at?: string | null;
}

interface SupportReplyRow {
  id: number;
  ticket_id: number;
  message_text: string | null;
  photo_file_id: string | null;
  created_at: string;
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanUsername(value: string | null | undefined): string | null {
  const trimmed = value?.trim().replace(/^@+/, "");
  return trimmed ? trimmed : null;
}

export function formatSupportTicketNumber(id: number): string {
  return `SUP-${String(id).padStart(6, "0")}`;
}

export function isSupportTicketOpen(ticket: SupportTicket): boolean {
  return ticket.status.trim().toLowerCase() !== "closed";
}

export function formatSupportCustomerName(ticket: SupportTicket): string {
  const name = [ticket.firstName, ticket.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();
  return name || "غير متوفر";
}

function mapTicketRow(row: SupportTicketRow): SupportTicket {
  return {
    id: row.id,
    ticketNumber: row.ticket_number?.trim()
      ? row.ticket_number.trim()
      : formatSupportTicketNumber(row.id),
    telegramUserId: Number(row.telegram_user_id),
    firstName: cleanText(row.first_name),
    lastName: cleanText(row.last_name),
    username: cleanUsername(row.username),
    messageText: cleanText(row.message_text),
    photoFileId: cleanText(row.photo_file_id),
    status: row.status,
    createdAt: row.created_at,
    closedAt: cleanText(row.closed_at),
  };
}

function mapReplyRow(row: SupportReplyRow): SupportReply {
  return {
    id: row.id,
    ticketId: Number(row.ticket_id),
    messageText: cleanText(row.message_text),
    photoFileId: cleanText(row.photo_file_id),
    createdAt: row.created_at,
  };
}

function getTicketRow(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): SupportTicketRow | undefined {
  return stmt.get(...params) as unknown as SupportTicketRow | undefined;
}

function getTicketRows(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): SupportTicketRow[] {
  return stmt.all(...params) as unknown as SupportTicketRow[];
}

function getReplyRow(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): SupportReplyRow | undefined {
  return stmt.get(...params) as unknown as SupportReplyRow | undefined;
}

export function createSupportTicket(
  input: CreateSupportTicketInput
): SupportTicket {
  const db = getDatabase();
  const result = db
    .prepare(
      `
        INSERT INTO support_tickets (
          telegram_user_id,
          first_name,
          last_name,
          username,
          message_text,
          photo_file_id,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, 'open')
      `
    )
    .run(
      input.telegramUserId,
      cleanText(input.firstName),
      cleanText(input.lastName),
      cleanUsername(input.username),
      cleanText(input.messageText),
      cleanText(input.photoFileId)
    );

  const ticketId = Number(result.lastInsertRowid);
  db.prepare(
    `
      UPDATE support_tickets
      SET ticket_number = ?
      WHERE id = ?
        AND (ticket_number IS NULL OR ticket_number = '')
    `
  ).run(formatSupportTicketNumber(ticketId), ticketId);

  const ticket = getSupportTicketById(ticketId);
  if (!ticket) {
    throw new Error("Failed to retrieve support ticket after creation");
  }
  return ticket;
}

export function getSupportTicketById(id: number): SupportTicket | null {
  const db = getDatabase();
  const row = getTicketRow(
    db.prepare("SELECT * FROM support_tickets WHERE id = ?"),
    id
  );
  return row ? mapTicketRow(row) : null;
}

export function countSupportTickets(filter: SupportTicketListFilter): number {
  const db = getDatabase();
  if (filter === "all") {
    const row = db.prepare("SELECT COUNT(*) AS total FROM support_tickets").get() as
      | { total: number }
      | undefined;
    return Number(row?.total ?? 0);
  }

  const row = db
    .prepare("SELECT COUNT(*) AS total FROM support_tickets WHERE status = ?")
    .get(filter) as { total: number } | undefined;
  return Number(row?.total ?? 0);
}

export function getSupportTicketCounts(): {
  open: number;
  closed: number;
  all: number;
} {
  return {
    open: countSupportTickets("open"),
    closed: countSupportTickets("closed"),
    all: countSupportTickets("all"),
  };
}

export function listSupportTickets(
  filter: SupportTicketListFilter,
  page: number,
  pageSize: number
): { tickets: SupportTicket[]; page: number; totalPages: number; total: number } {
  const total = countSupportTickets(filter);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 0), totalPages - 1);
  const offset = safePage * pageSize;
  const db = getDatabase();

  const rows =
    filter === "all"
      ? getTicketRows(
          db.prepare(
            "SELECT * FROM support_tickets ORDER BY id DESC LIMIT ? OFFSET ?"
          ),
          pageSize,
          offset
        )
      : getTicketRows(
          db.prepare(
            "SELECT * FROM support_tickets WHERE status = ? ORDER BY id DESC LIMIT ? OFFSET ?"
          ),
          filter,
          pageSize,
          offset
        );

  return {
    tickets: rows.map(mapTicketRow),
    page: safePage,
    totalPages,
    total,
  };
}

export function closeSupportTicket(id: number): SupportTicket | null {
  const db = getDatabase();
  const result = db
    .prepare(
      `
        UPDATE support_tickets
        SET status = 'closed',
            closed_at = datetime('now')
        WHERE id = ?
          AND LOWER(TRIM(status)) != 'closed'
      `
    )
    .run(id);

  if (Number(result.changes) === 0) {
    return null;
  }

  return getSupportTicketById(id);
}

export function addSupportReply(input: CreateSupportReplyInput): SupportReply {
  const db = getDatabase();
  const result = db
    .prepare(
      `
        INSERT INTO support_replies (
          ticket_id,
          message_text,
          photo_file_id
        )
        VALUES (?, ?, ?)
      `
    )
    .run(
      input.ticketId,
      cleanText(input.messageText),
      cleanText(input.photoFileId)
    );

  const replyId = Number(result.lastInsertRowid);
  const row = getReplyRow(
    db.prepare("SELECT * FROM support_replies WHERE id = ?"),
    replyId
  );
  if (!row) {
    throw new Error("Failed to retrieve support reply after creation");
  }
  return mapReplyRow(row);
}

export function countSupportReplies(ticketId: number): number {
  const db = getDatabase();
  const row = db
    .prepare(
      "SELECT COUNT(*) AS total FROM support_replies WHERE ticket_id = ?"
    )
    .get(ticketId) as { total: number } | undefined;
  return Number(row?.total ?? 0);
}

export function getLatestSupportReply(ticketId: number): SupportReply | null {
  const db = getDatabase();
  const row = getReplyRow(
    db.prepare(
      "SELECT * FROM support_replies WHERE ticket_id = ? ORDER BY id DESC LIMIT 1"
    ),
    ticketId
  );
  return row ? mapReplyRow(row) : null;
}
