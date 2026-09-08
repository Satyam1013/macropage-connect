import { IsString, IsNotEmpty, MinLength } from "class-validator";

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  projectName!: string;
}
