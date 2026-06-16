import { IsString, IsNotEmpty, IsOptional, IsArray } from "class-validator";

export class CreateQuickReplyDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
