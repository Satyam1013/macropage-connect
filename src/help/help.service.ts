import { Injectable } from "@nestjs/common";

const FAQ = [
  {
    id: "1",
    title: "How to connect WhatsApp?",
    category: "whatsapp",
    content: "Go to WhatsApp Setup and follow the Embedded Signup flow.",
  },
  {
    id: "2",
    title: "How to create a campaign?",
    category: "campaigns",
    content:
      "Navigate to Campaigns, click New Campaign, select a template and audience.",
  },
  {
    id: "3",
    title: "How to invite team members?",
    category: "team",
    content: "Go to Team settings and use the Invite button.",
  },
];

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
