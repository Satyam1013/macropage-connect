import { IsString, MinLength, Matches } from "class-validator";
import { Transform } from "class-transformer";

export class ResetPasswordDto {
  @IsString()
  token!: string;

  // Accept both "newPassword" (preferred) and "password" (legacy frontend)
  @Transform(({ obj }: { obj: Record<string, unknown> }) =>
    obj["newPassword"] ?? obj["password"],
  )
  @IsString()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]{8,}$/,
    {
      message:
        "Password must contain uppercase, lowercase, number and special character",
    },
  )
  newPassword!: string;

  // Accept both "confirmPassword" (preferred) and "confirm" (legacy frontend)
  @Transform(({ obj }: { obj: Record<string, unknown> }) =>
    obj["confirmPassword"] ?? obj["confirm"],
  )
  @IsString()
  confirmPassword!: string;
}
