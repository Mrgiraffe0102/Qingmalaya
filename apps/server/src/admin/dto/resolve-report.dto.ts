import { IsIn, IsString, MaxLength, IsOptional } from 'class-validator';

/**
 * Body for PUT /admin/comments/:id/report/resolve — resolves a pending
 * comment report. `delete` removes the comment (soft-hide if it has replies);
 * `dismiss` keeps the comment and marks the report as resolved.
 */
export class ResolveReportDto {
  @IsIn(['dismiss', 'delete'])
  action!: 'dismiss' | 'delete';

  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}
