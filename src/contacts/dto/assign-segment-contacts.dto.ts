import { IsArray, IsMongoId } from "class-validator";

export class AssignSegmentContactsDto {
  @IsArray()
  @IsMongoId({ each: true })
  contactIds!: string[];
}
