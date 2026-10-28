import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { SEARCH_QUERY_LIMITS } from '../../domain/search-query';

/**
 * Query string of `GET /search`. Only shape and type coercion live here; the
 * business bounds (trimmed length, page size cap) are enforced by `SearchQuery`.
 */
export class SearchQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(SEARCH_QUERY_LIMITS.maxLength)
  q!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
