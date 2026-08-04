import { IsNumber, IsOptional, IsString, IsUrl } from "class-validator";
import { Type } from "class-transformer";

export class UpdateVideoTutorialDto {
  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  order?: number;
}
