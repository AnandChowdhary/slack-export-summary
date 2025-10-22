const fs = require("fs");
const path = require("path");
const {
  loadJsonFile,
  createUserMapping,
  generateMonthMarkdown,
} = require("../index.js");

describe("Slack Export Summary CLI", () => {
  const testDataPath = path.join(__dirname, "test-data");

  describe("loadJsonFile", () => {
    test("should load and parse valid JSON file", () => {
      const usersPath = path.join(testDataPath, "users.json");
      const result = loadJsonFile(usersPath);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty("id", "U123456");
    });

    test("should return empty array for non-existent file", () => {
      const result = loadJsonFile("non-existent-file.json");
      expect(result).toEqual([]);
    });

    test("should return empty array for invalid JSON", () => {
      // Create a temporary invalid JSON file
      const invalidPath = path.join(testDataPath, "invalid.json");
      fs.writeFileSync(invalidPath, "{ invalid json }");

      const result = loadJsonFile(invalidPath);
      expect(result).toEqual([]);

      // Clean up
      fs.unlinkSync(invalidPath);
    });
  });

  describe("createUserMapping", () => {
    test("should create user mapping with display_name", () => {
      const users = [
        {
          id: "U123456",
          profile: {
            display_name: "John Doe",
            real_name: "John Doe",
          },
        },
      ];

      const userMap = createUserMapping(users);

      expect(userMap.get("U123456")).toBe("John Doe");
    });

    test("should fallback to real_name when display_name is missing", () => {
      const users = [
        {
          id: "U123456",
          profile: {
            real_name: "John Doe",
          },
        },
      ];

      const userMap = createUserMapping(users);

      expect(userMap.get("U123456")).toBe("John Doe");
    });

    test("should fallback to name when profile is missing", () => {
      const users = [
        {
          id: "U123456",
          name: "john.doe",
        },
      ];

      const userMap = createUserMapping(users);

      expect(userMap.get("U123456")).toBe("john.doe");
    });

    test("should fallback to user ID when no name available", () => {
      const users = [
        {
          id: "U123456",
        },
      ];

      const userMap = createUserMapping(users);

      expect(userMap.get("U123456")).toBe("U123456");
    });
  });

  describe("generateMonthMarkdown", () => {
    const userMap = new Map([
      ["U123456", "John Doe"],
      ["U789012", "Jane Smith"],
      ["U345678", "bob.wilson"],
    ]);

    test("should generate markdown with timestamps", () => {
      const monthData = new Map([
        [
          "2021-02-15",
          new Map([
            [
              "channel-1",
              [
                {
                  user: "U123456",
                  type: "message",
                  ts: "1613401200.000100",
                  text: "Hello everyone!",
                },
              ],
            ],
          ]),
        ],
      ]);

      const result = generateMonthMarkdown("2021-02", monthData, userMap, {
        timestamps: true,
      });

      expect(result).toContain("# 2021-02");
      expect(result).toContain("## February 15, 2021");
      expect(result).toContain("### #channel-1");
      expect(result).toContain("@John Doe: Hello everyone!");
      expect(result).toMatch(
        /\d{1,2}:\d{2}:\d{2} (AM|PM) @John Doe: Hello everyone!/
      );
    });

    test("should generate markdown without timestamps", () => {
      const monthData = new Map([
        [
          "2021-02-15",
          new Map([
            [
              "channel-1",
              [
                {
                  user: "U123456",
                  type: "message",
                  ts: "1613401200.000100",
                  text: "Hello everyone!",
                },
              ],
            ],
          ]),
        ],
      ]);

      const result = generateMonthMarkdown("2021-02", monthData, userMap, {
        timestamps: false,
      });

      expect(result).toContain("# 2021-02");
      expect(result).toContain("## February 15, 2021");
      expect(result).toContain("### #channel-1");
      expect(result).toContain("@John Doe: Hello everyone!");
      expect(result).not.toContain("12:00:00 PM");
    });

    test("should handle multiple dates and channels", () => {
      const monthData = new Map([
        [
          "2021-02-15",
          new Map([
            [
              "channel-1",
              [{ user: "U123456", type: "message", text: "Message 1" }],
            ],
            [
              "channel-2",
              [{ user: "U789012", type: "message", text: "Message 2" }],
            ],
          ]),
        ],
        [
          "2021-02-16",
          new Map([
            [
              "channel-1",
              [{ user: "U345678", type: "message", text: "Message 3" }],
            ],
          ]),
        ],
      ]);

      const result = generateMonthMarkdown("2021-02", monthData, userMap, {
        timestamps: false,
      });

      expect(result).toContain("## February 15, 2021");
      expect(result).toContain("## February 16, 2021");
      expect(result).toContain("### #channel-1");
      expect(result).toContain("### #channel-2");
      expect(result).toContain("@John Doe: Message 1");
      expect(result).toContain("@Jane Smith: Message 2");
      expect(result).toContain("@bob.wilson: Message 3");
    });

    test("should filter out non-message types", () => {
      const monthData = new Map([
        [
          "2021-02-15",
          new Map([
            [
              "channel-1",
              [
                { user: "U123456", type: "message", text: "Valid message" },
                { user: "U123456", type: "file_share", text: "Invalid type" },
                { user: "U123456", type: "message", text: "" }, // Empty text
                { user: "U123456", type: "message" }, // No text property
              ],
            ],
          ]),
        ],
      ]);

      const result = generateMonthMarkdown("2021-02", monthData, userMap, {
        timestamps: false,
      });

      expect(result).toContain("@John Doe: Valid message");
      expect(result).not.toContain("Invalid type");
      expect(result).not.toContain("Empty text");
    });

    test("should handle user mentions in messages", () => {
      const monthData = new Map([
        [
          "2021-02-15",
          new Map([
            [
              "channel-1",
              [
                {
                  user: "U123456",
                  type: "message",
                  text: "Hi <@U789012>, how are you?",
                },
              ],
            ],
          ]),
        ],
      ]);

      const result = generateMonthMarkdown("2021-02", monthData, userMap, {
        timestamps: false,
      });

      expect(result).toContain("@John Doe: Hi @Jane Smith, how are you?");
    });

    test("should handle unknown user IDs", () => {
      const monthData = new Map([
        [
          "2021-02-15",
          new Map([
            [
              "channel-1",
              [
                {
                  user: "UUNKNOWN",
                  type: "message",
                  text: "Message from unknown user",
                },
              ],
            ],
          ]),
        ],
      ]);

      const result = generateMonthMarkdown("2021-02", monthData, userMap, {
        timestamps: false,
      });

      expect(result).toContain("@UUNKNOWN: Message from unknown user");
    });
  });
});
