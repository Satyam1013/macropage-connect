import { IsString, IsNotEmpty, IsOptional, IsEmail } from "class-validator";

export class BusinessInfoDto {
  @IsString()
  @IsNotEmpty()
  businessName!: string;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class ConnectMetaDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsString()
  wabaId?: string;

  @IsOptional()
  @IsString()
  phoneNumberId?: string;
}

export class VerifyPhoneDto {
  @IsString()
  @IsNotEmpty()
  phoneNumberId!: string;

  @IsString()
  @IsNotEmpty()
  method!: "SMS" | "VOICE";
}

export class ConfirmPhoneDto {
  @IsString()
  @IsNotEmpty()
  phoneNumberId!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;
}
