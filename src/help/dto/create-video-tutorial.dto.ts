import { IsNumber, IsOptional, IsString, IsUrl } from "class-validator";
import { Type } from "class-transformer";

export class CreateVideoTutorialDto {
  @IsUrl()
  url!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  order?: number;
}
