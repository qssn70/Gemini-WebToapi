const express = require("express");
const request = require("supertest");
const { createHealthRoutes } = require("../../src/routes/HealthRoutes");

describe("HealthRoutes", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    const authSource = {
      getRotationIndices: () => [0, 1],
      getAvailableIndices: () => [0, 1, 2],
    };
    const browserPool = { browser: {} };
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };

    const healthRoutes = createHealthRoutes({
      authSource,
      browserPool,
      logger,
    });
    app.use("/", healthRoutes);
  });

  test("GET /health returns 200 with status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("timestamp");
    expect(res.body.authCount).toBe(3);
    expect(res.body.rotationCount).toBe(2);
    expect(res.body.browserStarted).toBe(true);
  });
});
