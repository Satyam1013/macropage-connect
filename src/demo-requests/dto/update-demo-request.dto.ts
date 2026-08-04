import { IsEnum } from "class-validator";

export const DEMO_REQUEST_STATUSES = [
  "PENDING",
  "CONTACTED",
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type DemoRequestStatus = (typeof DEMO_REQUEST_STATUSES)[number];

export class UpdateDemoRequestDto {
  @IsEnum(DEMO_REQUEST_STATUSES)
  status!: DemoRequestStatus;
}
