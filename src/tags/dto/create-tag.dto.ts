import { IsOptional, IsString } from "class-validator";

export class CreateTagDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
