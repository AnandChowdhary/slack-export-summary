/**
 * Demo test to show the CLI working with test data
 */
describe("Demo Tests", () => {
  test("should demonstrate CLI functionality", () => {
    const { loadJsonFile, createUserMapping } = require("../index.js");

    // Load test users
    const users = loadJsonFile(__dirname + "/test-data/users.json");
    expect(users).toHaveLength(3);

    // Create user mapping
    const userMap = createUserMapping(users);
    expect(userMap.get("U123456")).toBe("John Doe");
    expect(userMap.get("U789012")).toBe("Jane Smith");
    expect(userMap.get("U345678")).toBe("bob.wilson");

    console.log("✅ Demo test passed - CLI functions work correctly!");
  });
});
