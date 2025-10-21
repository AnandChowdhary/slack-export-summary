const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

describe("Integration Tests", () => {
  const testDataPath = path.join(__dirname, "test-data");
  const outputPath = path.join(__dirname, "test-output");

  beforeEach(() => {
    // Clean up any existing test output
    if (fs.existsSync(outputPath)) {
      fs.rmSync(outputPath, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test output after each test
    if (fs.existsSync(outputPath)) {
      fs.rmSync(outputPath, { recursive: true, force: true });
    }
  });

  test("should process test data and generate monthly files", () => {
    // Run the CLI tool
    const command = `node index.js "${testDataPath}" -o "${outputPath}"`;

    expect(() => {
      execSync(command, { stdio: "pipe" });
    }).not.toThrow();

    // Check that output directory was created
    expect(fs.existsSync(outputPath)).toBe(true);

    // Check that monthly files were created
    const files = fs.readdirSync(outputPath);
    expect(files).toContain("2021-02.md");
    expect(files).toContain("2021-03.md");

    // Check content of February file
    const febContent = fs.readFileSync(
      path.join(outputPath, "2021-02.md"),
      "utf8"
    );
    expect(febContent).toContain("# 2021-02");
    expect(febContent).toContain("## February 15, 2021");
    expect(febContent).toContain("## February 16, 2021");
    expect(febContent).toContain("### channel-1");
    expect(febContent).toContain("### channel-2");
    expect(febContent).toContain("@John Doe:");
    expect(febContent).toContain("@Jane Smith:");
    expect(febContent).toContain("@bob.wilson:");

    // Check content of March file
    const marContent = fs.readFileSync(
      path.join(outputPath, "2021-03.md"),
      "utf8"
    );
    expect(marContent).toContain("# 2021-03");
    expect(marContent).toContain("## March 1, 2021");
    expect(marContent).toContain("@Jane Smith: Message in March");
  });

  test("should generate files without timestamps when --no-timestamps is used", () => {
    // Run the CLI tool without timestamps
    const command = `node index.js "${testDataPath}" -o "${outputPath}" --no-timestamps`;

    expect(() => {
      execSync(command, { stdio: "pipe" });
    }).not.toThrow();

    // Check that files were created
    expect(fs.existsSync(outputPath)).toBe(true);
    const files = fs.readdirSync(outputPath);
    expect(files).toContain("2021-02.md");

    // Check that timestamps are not included
    const febContent = fs.readFileSync(
      path.join(outputPath, "2021-02.md"),
      "utf8"
    );
    expect(febContent).toContain("@John Doe: Hello everyone!");
    expect(febContent).not.toMatch(/\d{1,2}:\d{2}:\d{2} (AM|PM)/);
  });

  test("should handle missing users.json file gracefully", () => {
    // Create a temporary test directory without users.json
    const tempTestPath = path.join(__dirname, "temp-test-data");
    const tempChannelPath = path.join(tempTestPath, "test-channel");

    fs.mkdirSync(tempTestPath, { recursive: true });
    fs.mkdirSync(tempChannelPath, { recursive: true });

    // Create a message file
    fs.writeFileSync(
      path.join(tempChannelPath, "2021-02-15.json"),
      JSON.stringify([
        {
          user: "U123456",
          type: "message",
          text: "Test message",
        },
      ])
    );

    // Run the CLI tool - should fail gracefully
    const command = `node index.js "${tempTestPath}" -o "${outputPath}"`;

    expect(() => {
      execSync(command, { stdio: "pipe" });
    }).toThrow(/Users file not found/);

    // Clean up
    fs.rmSync(tempTestPath, { recursive: true, force: true });
  });

  test("should handle empty channel directories", () => {
    // Create a temporary test directory with an empty channel
    const tempTestPath = path.join(__dirname, "temp-test-data");
    const tempChannelPath = path.join(tempTestPath, "empty-channel");

    fs.mkdirSync(tempTestPath, { recursive: true });
    fs.mkdirSync(tempChannelPath, { recursive: true });

    // Copy users.json
    fs.copyFileSync(
      path.join(testDataPath, "users.json"),
      path.join(tempTestPath, "users.json")
    );

    // Run the CLI tool
    const command = `node index.js "${tempTestPath}" -o "${outputPath}"`;

    expect(() => {
      execSync(command, { stdio: "pipe" });
    }).not.toThrow();

    // Should not create any monthly files since there are no messages
    expect(fs.existsSync(outputPath)).toBe(true);
    const files = fs.readdirSync(outputPath);
    expect(files).toHaveLength(0);

    // Clean up
    fs.rmSync(tempTestPath, { recursive: true, force: true });
  });

  test("should handle invalid JSON files gracefully", () => {
    // Create a temporary test directory with invalid JSON
    const tempTestPath = path.join(__dirname, "temp-test-data");
    const tempChannelPath = path.join(tempTestPath, "test-channel");

    fs.mkdirSync(tempTestPath, { recursive: true });
    fs.mkdirSync(tempChannelPath, { recursive: true });

    // Copy users.json
    fs.copyFileSync(
      path.join(testDataPath, "users.json"),
      path.join(tempTestPath, "users.json")
    );

    // Create an invalid JSON file
    fs.writeFileSync(
      path.join(tempChannelPath, "2021-02-15.json"),
      "{ invalid json content }"
    );

    // Run the CLI tool - should not crash
    const command = `node index.js "${tempTestPath}" -o "${outputPath}"`;

    expect(() => {
      execSync(command, { stdio: "pipe" });
    }).not.toThrow();

    // Should not create any monthly files since the JSON was invalid
    expect(fs.existsSync(outputPath)).toBe(true);
    const files = fs.readdirSync(outputPath);
    expect(files).toHaveLength(0);

    // Clean up
    fs.rmSync(tempTestPath, { recursive: true, force: true });
  });
});
