import { IsArray, IsBoolean, IsInt } from 'class-validator';

/**
 * Body for PUT /admin/users/:id/managed-classes — set a teacher's managed
 * classes. When `manageAllClasses` is true, `classIds` is ignored (the teacher
 * sees all classes). When false, `classIds` is the explicit list (may be empty
 * to grant no class access).
 */
export class SetManagedClassesDto {
  @IsArray()
  @IsInt({ each: true })
  classIds!: number[];

  @IsBoolean()
  manageAllClasses!: boolean;
}
