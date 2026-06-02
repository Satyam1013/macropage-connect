import { IsString, IsNotEmpty, IsIn } from "class-validator";

export class OAuthDto {
  @IsString()
  @IsIn(["google", "facebook", "github"], {
    message: "Provider must be google, facebook, or github",
  })
  provider!: string;

  @IsString()
  @IsNotEmpty({ message: "OAuth token is required" })
  token!: string;
}
