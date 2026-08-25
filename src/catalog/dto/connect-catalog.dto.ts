import { IsString, IsNotEmpty } from "class-validator";

export class ConnectCatalogDto {
  @IsString()
  @IsNotEmpty()
  code!: string;
}
