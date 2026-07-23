import { IsString, IsNotEmpty, IsOptional, Matches } from "class-validator";

export class CreateSegmentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: "Color must be a hex code, e.g. #f59e0b",
  })
  color?: string;

  @IsOptional()
  filters?: Record<string, unknown>;
}
