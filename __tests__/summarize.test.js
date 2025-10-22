const fs = require("fs");
const path = require("path");

// Mock environment variable before requiring the module
process.env.OPEN_API_KEY = "test_api_key_for_testing";

const { getMonthlyFiles } = require("../summarize");

describe("Summarization functionality", () => {
  const testDataPath = path.join(__dirname, "test-data");
  const outputPath = path.join(testDataPath, "output");

  beforeEach(() => {
    // Create test output directory with sample files
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }

    // Create sample monthly files
    const sampleContent = `# 2021-02

## February 15, 2021

### channel-1

6:30:04 PM @John: Hello everyone!
6:30:11 PM @Jane: How is everyone doing?`;

    fs.writeFileSync(path.join(outputPath, "2021-02.md"), sampleContent);
    fs.writeFileSync(path.join(outputPath, "2021-03.md"), sampleContent);
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(outputPath)) {
      fs.rmSync(outputPath, { recursive: true, force: true });
    }
  });

  test("should get monthly files correctly", () => {
    const files = getMonthlyFiles(outputPath);

    expect(files).toHaveLength(2);
    expect(files).toContain("2021-02.md");
    expect(files).toContain("2021-03.md");
  });

  test("should filter out non-monthly files", () => {
    // Add a non-monthly file
    fs.writeFileSync(path.join(outputPath, "readme.md"), "Not a monthly file");
    fs.writeFileSync(path.join(outputPath, "2021-02-15.md"), "Wrong format");

    const files = getMonthlyFiles(outputPath);

    expect(files).toHaveLength(2);
    expect(files).not.toContain("readme.md");
    expect(files).not.toContain("2021-02-15.md");
  });
});
