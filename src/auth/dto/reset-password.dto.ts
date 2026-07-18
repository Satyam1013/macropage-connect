import { IsString, MinLength, Matches, IsOptional } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  token!: string;

  // Primary field — frontend sends "password"
  @IsString()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]{8,}$/,
    {
      message:
        "Password must contain uppercase, lowercase, number and special character",
    },
  )
  password!: string;

  // Optional confirm — skip mismatch check if frontend doesn't send it
  @IsOptional()
  @IsString()
  confirmPassword?: string;
}
