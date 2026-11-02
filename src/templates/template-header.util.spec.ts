import {
  headerComponent,
  mergeSyncedHeader,
  resolveHeaderMedia,
  templateVarIndex,
} from "./template-header.util";

const SAVED = "https://cdn.example.com/media/photo.jpeg";

describe("resolveHeaderMedia", () => {
  it('uses the saved media when the request only says {type: "HEADER"}', () => {
    expect(
      resolveHeaderMedia(
        { type: "HEADER" },
        { format: "IMAGE", mediaUrl: SAVED },
      ),
    ).toEqual({ format: "IMAGE", link: SAVED });
  });

  it("prefers a link sent with the request", () => {
    expect(
      resolveHeaderMedia(
        { format: "image", mediaUrl: "https://x.test/new.png" },
        { format: "IMAGE", mediaUrl: SAVED },
      ).link,
    ).toBe("https://x.test/new.png");
  });

  it("falls back to Meta's sample URL after a sync", () => {
    expect(
      resolveHeaderMedia(undefined, {
        format: "IMAGE",
        example: { header_handle: ["https://scontent.test/a.jpg"] },
      }).link,
    ).toBe("https://scontent.test/a.jpg");
  });

  it("reports a media header with no usable link", () => {
    expect(
      resolveHeaderMedia(
        { type: "HEADER" },
        { format: "IMAGE", example: { header_handle: ["4::aW1hZ2U="] } },
      ),
    ).toEqual({ format: "IMAGE", link: undefined });
  });

  it("ignores text headers and templates without a header", () => {
    expect(resolveHeaderMedia({ type: "HEADER" }, { format: "TEXT" })).toEqual(
      {},
    );
    expect(resolveHeaderMedia(undefined, undefined)).toEqual({});
  });
});

describe("headerComponent", () => {
  it("builds the Cloud API parameter", () => {
    expect(headerComponent({ format: "IMAGE", link: SAVED })).toEqual({
      type: "header",
      parameters: [{ type: "image", image: { link: SAVED } }],
    });
    expect(headerComponent({ format: "IMAGE" })).toBeNull();
  });
});

describe("mergeSyncedHeader", () => {
  it("keeps our saved link through a Meta sync", () => {
    expect(
      mergeSyncedHeader(
        { type: "HEADER", format: "IMAGE" },
        { format: "IMAGE", mediaUrl: SAVED },
      ),
    ).toEqual({ type: "HEADER", format: "IMAGE", mediaUrl: SAVED });
  });
});

describe("templateVarIndex", () => {
  it("orders both key styles numerically", () => {
    expect(
      ["{{10}}", "{{2}}", "1"].sort(
        (a, b) => templateVarIndex(a) - templateVarIndex(b),
      ),
    ).toEqual(["1", "{{2}}", "{{10}}"]);
  });
});
