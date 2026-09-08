import { IsString, IsNotEmpty } from "class-validator";

export class SelectProjectDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;
}
