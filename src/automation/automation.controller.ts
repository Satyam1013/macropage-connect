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
  ForbiddenException,
} from "@nestjs/common";
import { AutomationService } from "./automation.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PlanGuard } from "../billing/guards/plan.guard";
import { RequirePlan } from "../common/decorators/require-plan.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { UserRole } from "../auth/dto/signup.dto";
import type { AuthReq } from "../auth/dto/auth-request.interface";

@UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)
@Controller("automation")
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  // ─── Limits (no plan gate — every role needs to know what's locked) ────────

  @Get("limits")
  getLimits(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.automationService.getAutomationLimits(tenantId);
  }

  // ─── Rules ────────────────────────────────────────────────────────────────

  @Get("rules/test")
  async testRules(@Request() req: AuthReq) {
    const tenantId = req.user.tenantId ?? req.user.id;
    const result = await this.automationService.debugRules(tenantId);
    return result;
  }

  @Get("rules")
  @RequirePlan("automation")
  findRules(@Request() req: AuthReq) {
    return this.automationService.findAllRules(
      req.user.tenantId ?? req.user.id,
    );
  }

  @Post("rules")
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("automation")
  async createRule(
    @Request() req: AuthReq,
    @Body() dto: Record<string, unknown>,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    const limits = await this.automationService.getAutomationLimits(tenantId);

    if (
      limits.data.maxCustomRules !== -1 &&
      limits.data.currentRuleCount >= limits.data.maxCustomRules
    ) {
      throw new ForbiddenException({
        code: "RULE_LIMIT_REACHED",
        message: `Your plan allows up to ${limits.data.maxCustomRules} custom rules. Upgrade to add more.`,
        limit: limits.data.maxCustomRules,
        current: limits.data.currentRuleCount,
      });
    }

    return this.automationService.createRule(tenantId, dto);
  }

  @Put("rules/:id")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("automation")
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
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("automation")
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
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("automation")
  deleteRule(@Request() req: AuthReq, @Param("id") id: string) {
    return this.automationService.deleteRule(
      req.user.tenantId ?? req.user.id,
      id,
    );
  }

  // ─── Flows ────────────────────────────────────────────────────────────────

  @Get("flows")
  @RequirePlan("flowBuilder")
  findFlows(@Request() req: AuthReq) {
    return this.automationService.findAllFlows(
      req.user.tenantId ?? req.user.id,
    );
  }

  @Get("flows/:id")
  @RequirePlan("flowBuilder")
  findFlow(@Request() req: AuthReq, @Param("id") id: string) {
    return this.automationService.findOneFlow(
      req.user.tenantId ?? req.user.id,
      id,
    );
  }

  @Post("flows")
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("flowBuilder")
  createFlow(@Request() req: AuthReq, @Body() dto: Record<string, unknown>) {
    return this.automationService.saveFlow(
      req.user.tenantId ?? req.user.id,
      undefined,
      dto,
    );
  }

  @Put("flows/:id")
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("flowBuilder")
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
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("flowBuilder")
  publishFlow(@Request() req: AuthReq, @Param("id") id: string) {
    return this.automationService.publishFlow(
      req.user.tenantId ?? req.user.id,
      id,
    );
  }

  @Delete("flows/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.MANAGER)
  @RequirePlan("flowBuilder")
  deleteFlow(@Request() req: AuthReq, @Param("id") id: string) {
    return this.automationService.deleteFlow(
      req.user.tenantId ?? req.user.id,
      id,
    );
  }
}
