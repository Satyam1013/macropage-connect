import { IsArray, IsNumber, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";

export class CreateFaqDto {
  @IsString()
  category!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  order?: number;

  @IsString()
  question!: string;

  @IsString()
  answer!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
