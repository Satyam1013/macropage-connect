import { IsOptional, IsString } from "class-validator";

export class CreateDemoRequestDto {
  @IsString()
  phone!: string;

  @IsOptional()
  @IsString()
  message?: string;
}
