import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { getDatabase } from "./db";

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
}

export interface CreateSupportTicketInput {
  telegramUserId: number;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
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

function mapRow(row: SupportTicketRow): SupportTicket {
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
  };
}

function getRow(
  stmt: ReturnType<DatabaseSync["prepare"]>,
  ...params: SQLInputValue[]
): SupportTicketRow | undefined {
  return stmt.get(...params) as unknown as SupportTicketRow | undefined;
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
  const row = getRow(
    db.prepare("SELECT * FROM support_tickets WHERE id = ?"),
    id
  );
  return row ? mapRow(row) : null;
}
