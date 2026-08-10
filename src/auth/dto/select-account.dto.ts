import { IsString, IsNotEmpty } from "class-validator";

export class SelectAccountDto {
  @IsString()
  @IsNotEmpty()
  tenantId!: string;
}
