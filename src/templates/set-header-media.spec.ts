import { BadRequestException, HttpException } from "@nestjs/common";
import { TemplatesService } from "./templates.service";

const URL_OK = "https://cdn.example.com/media/photo.jpeg";

function setup(header: Record<string, unknown> | undefined) {
  const exec = <T>(v: T) => ({ exec: () => Promise.resolve(v) });
  const templateModel = {
    findOne: jest.fn(() => exec({ _id: "t1", header })),
    findOneAndUpdate: jest.fn(() =>
      exec({ _id: "t1", header: { ...header, mediaUrl: URL_OK } }),
    ),
  };
  const service = new TemplatesService(templateModel as never, {} as never);
  return { service, templateModel };
}

const code = (err: unknown) =>
  (
    (err as HttpException).getResponse() as {
      error?: { code?: string };
    }
  ).error?.code;

describe("TemplatesService.setHeaderMedia", () => {
  it("saves the link locally without resubmitting to Meta", async () => {
    const t = setup({ type: "HEADER", format: "IMAGE" });
    await t.service.setHeaderMedia("tenant", "t1", URL_OK);
    expect(t.templateModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: "t1", tenantId: "tenant" },
      { $set: { "header.mediaUrl": URL_OK } },
      { new: true },
    );
  });

  it("rejects Meta's expiring preview links", async () => {
    const t = setup({ format: "IMAGE" });
    const err = await t.service
      .setHeaderMedia("tenant", "t1", "https://scontent.whatsapp.net/v/x.jpg")
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect(code(err)).toBe("INVALID_MEDIA_URL");
    expect(t.templateModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("rejects templates without a media header", async () => {
    for (const header of [{ format: "TEXT" }, undefined]) {
      const t = setup(header);
      const err = await t.service
        .setHeaderMedia("tenant", "t1", URL_OK)
        .catch((e: unknown) => e);
      expect(code(err)).toBe("TEMPLATE_HEADER_NOT_MEDIA");
    }
  });
});
