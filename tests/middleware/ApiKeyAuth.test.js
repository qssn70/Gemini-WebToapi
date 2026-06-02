const {
  createApiKeyAuthMiddleware,
} = require("../../src/middleware/ApiKeyAuth");

function createMockReqRes(authHeader, queryKey) {
  const req = {
    headers: authHeader ? { authorization: authHeader } : {},
    query: queryKey ? { key: queryKey } : {},
  };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return { req, res };
}

describe("ApiKeyAuth middleware", () => {
  const keys = ["test-key-123", "another-key"];
  const middleware = createApiKeyAuthMiddleware(keys);

  test("valid Bearer token: calls next", () => {
    const { req, res } = createMockReqRes("Bearer test-key-123");
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test("valid query key: calls next", () => {
    const { req, res } = createMockReqRes(null, "another-key");
    const next = jest.fn();
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test("missing key: returns 401", () => {
    const { req, res } = createMockReqRes();
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error.status).toBe("UNAUTHENTICATED");
    expect(next).not.toHaveBeenCalled();
  });

  test("invalid key: returns 401", () => {
    const { req, res } = createMockReqRes("Bearer wrong-key");
    const next = jest.fn();
    middleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
