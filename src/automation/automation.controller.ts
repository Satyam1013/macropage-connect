import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AutomationService } from "./automation.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PlanGuard } from "../billing/guards/plan.guard";
import { RequirePlan } from "../common/decorators/require-plan.decorator";
import type { AuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard, PlanGuard)
@RequirePlan("automation")
@Controller("automation")
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  // Rules
  @Get("rules")
  findRules(@Request() req: AuthReq) {
    return this.automationService.findAllRules(
      req.user.tenantId ?? req.user.id,
    );
  }

  @Post("rules")
  @HttpCode(HttpStatus.CREATED)
  createRule(@Request() req: AuthReq, @Body() dto: Record<string, unknown>) {
    return this.automationService.createRule(
      req.user.tenantId ?? req.user.id,
      dto,
    );
  }

  @Put("rules/:id")
  updateRule(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.automationService.updateRule(
      req.user.tenantId ?? req.user.id,
      id,
      dto,
    );
  }

  @Patch("rules/:id/toggle")
  toggleRule(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body("enabled") enabled: boolean,
  ) {
    return this.automationService.toggleRule(
      req.user.tenantId ?? req.user.id,
      id,
      enabled,
    );
  }

  @Delete("rules/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRule(@Request() req: AuthReq, @Param("id") id: string) {
    return this.automationService.deleteRule(
      req.user.tenantId ?? req.user.id,
      id,
    );
  }

  // Flows
  @Get("flows")
  findFlows(@Request() req: AuthReq) {
    return this.automationService.findAllFlows(
      req.user.tenantId ?? req.user.id,
    );
  }

  @Get("flows/:id")
  findFlow(@Request() req: AuthReq, @Param("id") id: string) {
    return this.automationService.findOneFlow(
      req.user.tenantId ?? req.user.id,
      id,
    );
  }

  @Post("flows")
  @HttpCode(HttpStatus.CREATED)
  createFlow(@Request() req: AuthReq, @Body() dto: Record<string, unknown>) {
    return this.automationService.saveFlow(
      req.user.tenantId ?? req.user.id,
      undefined,
      dto,
    );
  }

  @Put("flows/:id")
  updateFlow(
    @Request() req: AuthReq,
    @Param("id") id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.automationService.saveFlow(
      req.user.tenantId ?? req.user.id,
      id,
      dto,
    );
  }

  @Post("flows/:id/publish")
  publishFlow(@Request() req: AuthReq, @Param("id") id: string) {
    return this.automationService.publishFlow(
      req.user.tenantId ?? req.user.id,
      id,
    );
  }

  @Delete("flows/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFlow(@Request() req: AuthReq, @Param("id") id: string) {
    return this.automationService.deleteFlow(
      req.user.tenantId ?? req.user.id,
      id,
    );
  }
}
