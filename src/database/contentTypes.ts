export type ContentType = "video" | "game" | "file";

export type MediaKind = "video" | "document" | "photo" | "animation";

export interface ProductContentItem {
  id: number;
  productId: string;
  contentType: ContentType;
  titleAr: string;
  descriptionAr: string | null;
  telegramFileId: string;
  telegramFileUniqueId: string | null;
  mediaKind: MediaKind;
  fileName: string | null;
  mimeType: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface CreateContentInput {
  productId: string;
  contentType: ContentType;
  titleAr: string;
  descriptionAr?: string | null;
  telegramFileId: string;
  telegramFileUniqueId?: string | null;
  mediaKind: MediaKind;
  fileName?: string | null;
  mimeType?: string | null;
  sortOrder?: number;
}

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  video: "🎬 الفيديوهات",
  game: "🎮 الألعاب والأنشطة",
  file: "📁 الملفات",
};

export const CONTENT_TYPE_ADD_LABELS: Record<ContentType, string> = {
  video: "➕ إضافة فيديو",
  game: "➕ إضافة لعبة/نشاط",
  file: "➕ إضافة ملف",
};

export const CONTENT_TYPES: ContentType[] = ["video", "game", "file"];
