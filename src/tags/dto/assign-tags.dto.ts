import { IsArray, IsMongoId } from "class-validator";

export class AssignTagsDto {
  @IsMongoId()
  customerId!: string;

  @IsArray()
  @IsMongoId({ each: true })
  tagIds!: string[];
}
