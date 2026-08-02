import { IsString, IsNotEmpty, IsOptional, Matches } from "class-validator";

export class SendPublicMessageDto {
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: "phone must be in E.164 format (e.g. +919876543210)",
  })
  phone!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  @IsNotEmpty()
  templateName!: string;

  @IsOptional()
  templateVars?: Record<string, string>;
}
