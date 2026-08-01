import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { HelpService } from "./help.service";
import { CreateTicketDto } from "./dto/create-ticket.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthReq } from "../auth/dto/auth-request.interface";

@Controller("help")
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @Post("tickets")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  createTicket(@Request() req: AuthReq, @Body() dto: CreateTicketDto) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.helpService.createTicket(
      tenantId,
      { id: req.user.id, name: req.user.name, email: req.user.email },
      dto,
    );
  }

  @Get("docs")
  getDocs(@Query("category") category?: string) {
    return this.helpService.getDocs(category);
  }

  @Get("faq")
  getFaqs(@Query("category") category?: string) {
    return this.helpService.getFaqs(category);
  }

  @Get("search")
  search(@Query("q") q: string) {
    return this.helpService.search(q);
  }

  @Get("status")
  @UseGuards(JwtAuthGuard)
  getStatus(
    @Request() req: AuthReq,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    const tenantId = req.user.tenantId ?? req.user.id;
    return this.helpService.getSystemStatus(
      tenantId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  // Remove this endpoint after running once
  @Post("reseed")
  @HttpCode(HttpStatus.OK)
  async reseed() {
    const counts = await this.helpService.seedData(true);
    return { success: true, ...counts };
  }
}
