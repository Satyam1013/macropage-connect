import { ConversationsService } from "./conversations.service";

// updateMessageStatus with a mocked message model — checks the failure
// reason from Meta's status webhook is kept and pushed to the inbox.
function setup() {
  const msg = { _id: "m1", conversationId: "c1" };
  const msgModel = {
    findOneAndUpdate: jest.fn(() => ({ exec: () => Promise.resolve(msg) })),
  };
  const socketService = { messageStatus: jest.fn() };
  const campaignsService = {
    handleDeliveryUpdate: jest.fn().mockResolvedValue(undefined),
    handleDeliveryFailure: jest.fn().mockResolvedValue(undefined),
  };
  const service = Object.assign(
    Object.create(ConversationsService.prototype) as object,
    {
      msgModel,
      socketService,
      campaignsService,
      logger: { warn: jest.fn(), error: jest.fn(), log: jest.fn() },
    },
  ) as unknown as ConversationsService;
  return { service, msgModel, socketService, campaignsService };
}

describe("ConversationsService.updateMessageStatus", () => {
  it("stores and emits Meta's failure reason", async () => {
    const t = setup();
    await t.service.updateMessageStatus("tenant", "wamid.1", "failed", 1, [
      {
        code: 131053,
        title: "Media upload error",
        error_data: { details: "Unable to download the media from the URL" },
      },
    ]);

    const update = (t.msgModel.findOneAndUpdate.mock.calls[0] as unknown[])[1];
    expect(update).toMatchObject({
      status: "FAILED",
      errorCode: "131053",
      errorMessage:
        "Media upload error — Unable to download the media from the URL",
    });
    expect(t.socketService.messageStatus).toHaveBeenCalledWith(
      "tenant",
      expect.objectContaining({ status: "FAILED", errorCode: "131053" }),
    );
    expect(t.campaignsService.handleDeliveryFailure).toHaveBeenCalledWith(
      "wamid.1",
      "131053: Media upload error — Unable to download the media from the URL",
      1,
    );
  });

  it("leaves error fields alone for non-failed statuses", async () => {
    const t = setup();
    await t.service.updateMessageStatus("tenant", "wamid.1", "delivered", 1);
    const update = (t.msgModel.findOneAndUpdate.mock.calls[0] as unknown[])[1];
    expect(update).not.toHaveProperty("errorCode");
    expect(t.campaignsService.handleDeliveryFailure).not.toHaveBeenCalled();
  });
});
