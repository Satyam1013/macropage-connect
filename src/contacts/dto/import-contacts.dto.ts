import { IsUrl, IsOptional, IsIn, IsObject } from "class-validator";

export class ImportContactsDto {
  @IsUrl()
  fileUrl!: string;

  @IsOptional()
  @IsObject()
  columnMapping?: Record<string, string>;

  @IsOptional()
  @IsIn(["skip", "update"])
  duplicateHandling?: "skip" | "update";
}
