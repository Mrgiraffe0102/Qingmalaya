import { IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Body for PUT /admin/classes/:id/student-admins — sets which students in a
 * class are designated as student admins. `userIds` is the complete list of
 * student admin IDs for the class (not a delta): students not in the list are
 * demoted back to regular students.
 */
export class SetStudentAdminsDto {
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  userIds!: number[];
}
