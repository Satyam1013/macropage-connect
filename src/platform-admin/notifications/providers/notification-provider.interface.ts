export interface NotificationProvider {
  send(
    to: string,
    message: string,
  ): Promise<{ success: boolean; error?: string }>;
}
