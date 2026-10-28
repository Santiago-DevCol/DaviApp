import { Module } from '@nestjs/common';
import { SearchDocumentsUseCase } from './application/search-documents.use-case';
import { SEARCH_ENGINE, SearchEngine } from './domain/ports/search-engine';
import { SearchController } from './infrastructure/http/search.controller';
import { PostgresSearchEngine } from './infrastructure/persistence/postgres-search.engine';

/**
 * Composition root of the search capability. The use case is a plain class, so
 * it is assembled with a factory that receives the adapter bound to the port.
 */
@Module({
  controllers: [SearchController],
  providers: [
    { provide: SEARCH_ENGINE, useClass: PostgresSearchEngine },
    {
      provide: SearchDocumentsUseCase,
      inject: [SEARCH_ENGINE],
      useFactory: (engine: SearchEngine) => new SearchDocumentsUseCase({ engine }),
    },
  ],
})
export class SearchModule {}
