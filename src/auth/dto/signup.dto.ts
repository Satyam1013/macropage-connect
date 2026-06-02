import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsBoolean,
  IsEnum,
  Matches,
  IsNotEmpty,
} from "class-validator";

export enum UserRole {
  ADMIN = "admin",
  USER = "user",
}

export class SignupDto {
  @IsString()
  @IsNotEmpty({ message: "Name is required" })
  name!: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsEmail({}, { message: "Valid email required" })
  email!: string;

  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters" })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]{8,}$/,
    {
      message:
        "Password must contain uppercase, lowercase, number and special character",
    },
  )
  password!: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: "Phone must be in E.164 format (e.g. +919876543210)",
  })
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsBoolean()
  @Matches(/true/, {
    message: "You must accept the terms and conditions",
  })
  termsAccepted!: boolean;

  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;
}
