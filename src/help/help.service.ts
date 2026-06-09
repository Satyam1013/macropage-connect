import { FAQ } from "./help.constants";
import { Injectable } from "@nestjs/common";

@Injectable()
export class HelpService {
  search(query: string) {
    if (!query) return FAQ;
    const q = query.toLowerCase();
    return FAQ.filter(
      (f) =>
        f.title.toLowerCase().includes(q) ||
        f.content.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q),
    );
  }

  getSystemStatus() {
    return {
      overall: "operational",
      services: [
        { name: "API", status: "operational" },
        { name: "WhatsApp Gateway", status: "operational" },
        { name: "Database", status: "operational" },
      ],
      incidents: [],
      updatedAt: new Date().toISOString(),
    };
  }
}
