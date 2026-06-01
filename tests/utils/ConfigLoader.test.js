const { loadConfig } = require("../../src/utils/ConfigLoader");

describe("ConfigLoader", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AUTH_DIR;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("uses Docker auth mount path as default AUTH_DIR", () => {
    const config = loadConfig();

    expect(config.authDir).toBe("/app/configs/auth");
  });

  test("allows local AUTH_DIR override", () => {
    process.env.AUTH_DIR = "./auth";

    const config = loadConfig();

    expect(config.authDir).toBe("./auth");
  });
});
