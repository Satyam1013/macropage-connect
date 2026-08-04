import { IsArray, IsNumber, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";

export class CreateDocDto {
  @IsString()
  title!: string;

  @IsString()
  slug!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsString()
  content!: string;
}
