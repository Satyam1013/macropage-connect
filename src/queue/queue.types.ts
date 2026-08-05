export type EmailJobData = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type CampaignJobData = {
  campaignId: string;
};
