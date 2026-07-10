import { Controller, Get, Post, Query, HttpCode, HttpStatus } from "@nestjs/common";
import { HelpService } from "./help.service";

@Controller("help")
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

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
  getStatus() {
    return this.helpService.getSystemStatus();
  }

  // Remove this endpoint after running once
  @Post("reseed")
  @HttpCode(HttpStatus.OK)
  async reseed() {
    const counts = await this.helpService.seedData(true);
    return { success: true, ...counts };
  }
}
