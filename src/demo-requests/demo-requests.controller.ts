import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import { DemoRequestsService } from "./demo-requests.service";
import { CreateDemoRequestDto } from "./dto/create-demo-request.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard)
@Controller("demo-requests")
export class DemoRequestsController {
  constructor(private readonly demoRequestsService: DemoRequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: AuthReq, @Body() dto: CreateDemoRequestDto) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.demoRequestsService.create(
      tenantId,
      { id: req.user.id, name: req.user.name, email: req.user.email },
      dto,
    );
  }
}
