/**
 * Body for PUT /admin/settings — a flat { key: value } object of SystemSetting
 * updates. Every key is upserted.
 *
 * Declared as an interface (not a class) on purpose: the keys are dynamic
 * (e.g. "upload.maxFileSize") and cannot be expressed as class field names.
 * Because interfaces are erased at runtime, Nest's ValidationPipe treats the
 * metatype as Object and skips whitelist/validation — exactly what we want
 * for a free-form string map. Individual values are coerced to strings before
 * being written to the SystemSetting.value (TEXT) column.
 */
export interface AdminSettingsUpdateDto {
  [key: string]: string;
}
