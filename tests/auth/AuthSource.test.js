const fs = require("fs");
const path = require("path");
const os = require("os");
const AuthSource = require("../../src/auth/AuthSource");

function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "auth-source-test-"));
}

function createLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  };
}

function writeAuthFile(dir, index, data) {
  fs.writeFileSync(
    path.join(dir, `auth-${index}.json`),
    JSON.stringify(data),
    "utf-8"
  );
}

function makeAuth(overrides = {}) {
  return {
    cookies: [{ name: "SID", value: "abc", domain: ".google.com", path: "/" }],
    origins: [{ origin: "https://gemini.google.com", localStorage: [] }],
    ...overrides,
  };
}

describe("AuthSource", () => {
  let tmpDir;
  let logger;

  beforeEach(() => {
    tmpDir = createTmpDir();
    logger = createLogger();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("directory does not exist: returns empty lists, no crash", () => {
    const authSource = new AuthSource({
      authDir: path.join(tmpDir, "nonexistent"),
      logger,
    });
    authSource.reload();

    expect(authSource.getAvailableIndices()).toEqual([]);
    expect(authSource.getRotationIndices()).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  test("empty directory: returns empty lists", () => {
    const authSource = new AuthSource({ authDir: tmpDir, logger });
    authSource.reload();

    expect(authSource.getAvailableIndices()).toEqual([]);
    expect(authSource.getRotationIndices()).toEqual([]);
  });

  test("file name not matching: ignored", () => {
    fs.writeFileSync(path.join(tmpDir, "notauth.json"), "{}", "utf-8");
    fs.writeFileSync(path.join(tmpDir, "auth.json"), "{}", "utf-8");
    fs.writeFileSync(path.join(tmpDir, "auth-abc.json"), "{}", "utf-8");

    const authSource = new AuthSource({ authDir: tmpDir, logger });
    authSource.reload();

    expect(authSource.getAvailableIndices()).toEqual([]);
  });

  test("invalid JSON: ignored with warning", () => {
    fs.writeFileSync(path.join(tmpDir, "auth-0.json"), "not-json", "utf-8");

    const authSource = new AuthSource({ authDir: tmpDir, logger });
    authSource.reload();

    expect(authSource.getAvailableIndices()).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  test("missing cookies: ignored", () => {
    writeAuthFile(tmpDir, 0, { origins: [] });

    const authSource = new AuthSource({ authDir: tmpDir, logger });
    authSource.reload();

    expect(authSource.getAvailableIndices()).toEqual([]);
  });

  test("missing origins: ignored", () => {
    writeAuthFile(tmpDir, 0, { cookies: [] });

    const authSource = new AuthSource({ authDir: tmpDir, logger });
    authSource.reload();

    expect(authSource.getAvailableIndices()).toEqual([]);
  });

  test("normal auth file: enters available and rotation", () => {
    writeAuthFile(tmpDir, 0, makeAuth());

    const authSource = new AuthSource({ authDir: tmpDir, logger });
    authSource.reload();

    expect(authSource.getAvailableIndices()).toEqual([0]);
    expect(authSource.getRotationIndices()).toEqual([0]);
  });

  test("expired auth: in available but not in rotation", () => {
    writeAuthFile(tmpDir, 0, makeAuth({ expired: true }));

    const authSource = new AuthSource({ authDir: tmpDir, logger });
    authSource.reload();

    expect(authSource.getAvailableIndices()).toEqual([0]);
    expect(authSource.getRotationIndices()).toEqual([]);
    expect(authSource.isExpired(0)).toBe(true);
  });

  test("email duplicate: keep highest index", () => {
    writeAuthFile(tmpDir, 0, makeAuth({ accountName: "a@example.com" }));
    writeAuthFile(tmpDir, 3, makeAuth({ accountName: "A@example.com" }));

    const authSource = new AuthSource({ authDir: tmpDir, logger });
    authSource.reload();

    expect(authSource.getAvailableIndices()).toEqual([0, 3]);
    expect(authSource.getRotationIndices()).toEqual([3]);
    expect(authSource.getDuplicateIndices ? [0] : undefined);
    expect(authSource.getCanonicalIndex(0)).toBe(3);
    expect(authSource.getCanonicalIndex(3)).toBe(3);
  });

  test("non-email accountName: not deduplicated", () => {
    writeAuthFile(tmpDir, 0, makeAuth({ accountName: "my-account" }));
    writeAuthFile(tmpDir, 1, makeAuth({ accountName: "my-account" }));

    const authSource = new AuthSource({ authDir: tmpDir, logger });
    authSource.reload();

    expect(authSource.getRotationIndices()).toEqual([0, 1]);
  });

  test("no accountName: not deduplicated", () => {
    writeAuthFile(tmpDir, 0, makeAuth());
    writeAuthFile(tmpDir, 1, makeAuth());

    const authSource = new AuthSource({ authDir: tmpDir, logger });
    authSource.reload();

    expect(authSource.getRotationIndices()).toEqual([0, 1]);
  });

  test("getAuth returns full object preserving unknown fields", () => {
    const data = makeAuth({ customField: "preserved", anotherField: 42 });
    writeAuthFile(tmpDir, 0, data);

    const authSource = new AuthSource({ authDir: tmpDir, logger });
    authSource.reload();

    const auth = authSource.getAuth(0);
    expect(auth.customField).toBe("preserved");
    expect(auth.anotherField).toBe(42);
    expect(Array.isArray(auth.cookies)).toBe(true);
    expect(Array.isArray(auth.origins)).toBe(true);
  });

  test("getAuth returns null for nonexistent index", () => {
    const authSource = new AuthSource({ authDir: tmpDir, logger });
    authSource.reload();

    expect(authSource.getAuth(999)).toBeNull();
  });
});
