import { hasApiPermission } from "./api-key-permissions";

describe("hasApiPermission", () => {
  it("matches the exact resource:action spelling", () => {
    expect(hasApiPermission(["messages:send"], "messages:send")).toBe(true);
  });

  it("matches the dashboard spellings of the same permission", () => {
    for (const p of ["send_messages", "send messages", "Send-Messages", "messages.send"]) {
      expect(hasApiPermission([p], "messages:send")).toBe(true);
    }
  });

  it("lets full_access satisfy any permission", () => {
    expect(hasApiPermission(["full_access"], "messages:send")).toBe(true);
    expect(hasApiPermission(["read_conversations", "full access"], "messages:send")).toBe(true);
  });

  it("rejects other permissions", () => {
    expect(hasApiPermission(["read_conversations", "read_contacts"], "messages:send")).toBe(false);
    expect(hasApiPermission(["read_messages"], "messages:send")).toBe(false);
    expect(hasApiPermission(["write_contacts"], "messages:send")).toBe(false);
    expect(hasApiPermission([], "messages:send")).toBe(false);
  });
});
