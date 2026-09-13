export interface SchoolYear {
  id: number;
  nameAr: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface CatalogSubject {
  id: number;
  yearId: number;
  nameAr: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface CatalogContentType {
  id: number;
  slug: string;
  nameAr: string;
  emoji: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateSchoolYearInput {
  nameAr: string;
  sortOrder?: number;
}

export interface CreateCatalogSubjectInput {
  yearId: number;
  nameAr: string;
  sortOrder?: number;
}

export interface CatalogTrimester {
  id: number;
  subjectId: number;
  nameAr: string;
  emoji: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateCatalogContentTypeInput {
  slug: string;
  nameAr: string;
  emoji?: string;
  sortOrder?: number;
}
