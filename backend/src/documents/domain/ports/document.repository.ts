import { Document } from '../document';

export interface DocumentRepository {
  save(document: Document): Promise<void>;
  findById(id: string): Promise<Document | null>;
  update(document: Document): Promise<void>;
}

export const DOCUMENT_REPOSITORY = Symbol('DocumentRepository');
