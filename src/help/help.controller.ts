import { Controller, Get, Query } from "@nestjs/common";
import { HelpService } from "./help.service";

@Controller("help")
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @Get("search")
  search(@Query("q") q: string) {
    return this.helpService.search(q);
  }

  @Get("status")
  getStatus() {
    return this.helpService.getSystemStatus();
  }
}
