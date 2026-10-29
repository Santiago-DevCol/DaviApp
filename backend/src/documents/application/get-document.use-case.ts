import { DocumentDetail } from '@techdocs/shared';
import { DocumentNotFoundError } from '../domain/errors';
import { DocumentRepository } from '../domain/ports/document.repository';
import { toDocumentDetail } from './document-detail.mapper';

export interface GetDocumentDependencies {
  repository: DocumentRepository;
}

export class GetDocumentUseCase {
  private readonly repository: DocumentRepository;

  constructor(deps: GetDocumentDependencies) {
    this.repository = deps.repository;
  }

  async execute(id: string): Promise<DocumentDetail> {
    const document = await this.repository.findById(id);
    if (!document) {
      throw new DocumentNotFoundError(id);
    }
    const versions = await this.repository.listVersionsByKey(document.documentKey);
    return toDocumentDetail(document, versions);
  }
}
