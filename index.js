#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { program } = require("commander");

/**
 * Parse command line arguments
 */
function parseArguments() {
  program
    .version("1.0.0")
    .description(
      "Convert Slack export folder structure to organized markdown files by month"
    )
    .argument(
      "<input-folder>",
      "Path to the data folder containing users.json and channel subfolders"
    )
    .option("-o, --output <folder>", "Output folder path", "output")
    .option("--no-timestamps", "Exclude timestamps from output")
    .parse();
}

/**
 * Load and parse JSON file
 */
function loadJsonFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Create user mapping from user ID to display name
 */
function createUserMapping(users) {
  const userMap = new Map();

  users.forEach((user) => {
    if (user.profile && user.profile.display_name) {
      userMap.set(user.id, user.profile.display_name);
    } else if (user.profile && user.profile.real_name) {
      userMap.set(user.id, user.profile.real_name);
    } else if (user.name) {
      userMap.set(user.id, user.name);
    } else {
      userMap.set(user.id, user.id); // fallback to ID
    }
  });

  return userMap;
}

/**
 * Create DM mapping from DM ID to participant names
 */
function createDMMapping(dms, userMap) {
  const dmMap = new Map();

  dms.forEach((dm) => {
    const participantNames = dm.members
      .map((userId) => userMap.get(userId) || userId)
      .filter((name) => name !== "USLACKBOT") // Filter out Slackbot
      .sort(); // Sort names for consistent ordering

    if (participantNames.length > 0) {
      const dmName =
        participantNames.length === 1
          ? `DM with ${participantNames[0]}`
          : `DM between ${participantNames.join(", ")}`;
      dmMap.set(dm.id, dmName);
    }
  });

  return dmMap;
}

/**
 * Clean up message text by replacing user mentions
 */
function cleanMessageText(text, userMap) {
  if (!text) return "";

  // Replace user mentions like <@U123456> with actual names
  return text.replace(/<@([A-Z0-9]+)>/g, (match, userId) => {
    const userName = userMap.get(userId) || userId;
    return `@${userName}`;
  });
}

/**
 * Get month key from date string (YYYY-MM-DD)
 */
function getMonthKey(dateStr) {
  return dateStr.substring(0, 7); // YYYY-MM
}

/**
 * Get date string from filename (YYYY-MM-DD.json -> YYYY-MM-DD)
 */
function getDateFromFilename(filename) {
  return filename.replace(".json", "");
}

/**
 * Format date for display (YYYY-MM-DD -> Month DD, YYYY)
 */
function formatDateForDisplay(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format timestamp to readable time
 */
function formatTime(timestamp) {
  const date = new Date(parseFloat(timestamp) * 1000);
  return date.toLocaleTimeString();
}

/**
 * Scan data folder and collect all messages organized by month
 */
function scanDataFolder(inputFolder, userMap, dmMap, options) {
  const messagesByMonth = new Map();
  const usersFile = path.join(inputFolder, "users.json");

  if (!fs.existsSync(usersFile)) {
    console.error(`Users file not found: ${usersFile}`);
    process.exit(1);
  }

  // Read all folders (channels and DMs)
  const items = fs.readdirSync(inputFolder, { withFileTypes: true });
  const allFolders = items
    .filter((item) => item.isDirectory())
    .map((item) => item.name);

  // Separate channels and DMs
  const channelFolders = allFolders.filter((folder) => !folder.startsWith("D"));
  const dmFolders = allFolders.filter((folder) => folder.startsWith("D"));

  console.log(
    `Found ${channelFolders.length} channels and ${dmFolders.length} DMs`
  );

  // Process channel folders
  channelFolders.forEach((channelName) => {
    const channelPath = path.join(inputFolder, channelName);
    const files = fs
      .readdirSync(channelPath)
      .filter((file) => file.endsWith(".json"));

    console.log(
      `Processing channel "${channelName}" with ${files.length} date files`
    );

    files.forEach((filename) => {
      const dateStr = getDateFromFilename(filename);
      const monthKey = getMonthKey(dateStr);
      const filePath = path.join(channelPath, filename);

      const messages = loadJsonFile(filePath);

      if (!messagesByMonth.has(monthKey)) {
        messagesByMonth.set(monthKey, new Map());
      }

      const monthData = messagesByMonth.get(monthKey);
      if (!monthData.has(dateStr)) {
        monthData.set(dateStr, new Map());
      }

      const dateData = monthData.get(dateStr);
      dateData.set(channelName, messages);
    });
  });

  // Process DM folders
  dmFolders.forEach((dmId) => {
    const dmPath = path.join(inputFolder, dmId);
    const files = fs
      .readdirSync(dmPath)
      .filter((file) => file.endsWith(".json"));

    const dmName = dmMap.get(dmId) || `DM ${dmId}`;
    console.log(`Processing DM "${dmName}" with ${files.length} date files`);

    files.forEach((filename) => {
      const dateStr = getDateFromFilename(filename);
      const monthKey = getMonthKey(dateStr);
      const filePath = path.join(dmPath, filename);

      const messages = loadJsonFile(filePath);

      if (!messagesByMonth.has(monthKey)) {
        messagesByMonth.set(monthKey, new Map());
      }

      const monthData = messagesByMonth.get(monthKey);
      if (!monthData.has(dateStr)) {
        monthData.set(dateStr, new Map());
      }

      const dateData = monthData.get(dateStr);
      dateData.set(dmName, messages);
    });
  });

  return messagesByMonth;
}

/**
 * Generate markdown content for a specific month
 */
function generateMonthMarkdown(monthKey, monthData, userMap, options) {
  let markdown = `# ${monthKey}\n\n`;

  // Sort dates within the month
  const sortedDates = Array.from(monthData.keys()).sort();

  sortedDates.forEach((dateStr) => {
    const dateData = monthData.get(dateStr);
    const displayDate = formatDateForDisplay(dateStr);

    markdown += `## ${displayDate}\n\n`;

    // Sort channels alphabetically
    const sortedChannels = Array.from(dateData.keys()).sort();

    sortedChannels.forEach((channelName) => {
      const messages = dateData.get(channelName);

      // Filter and process messages
      const validMessages = messages.filter(
        (msg) => msg.type === "message" && msg.text
      );

      if (validMessages.length > 0) {
        markdown += `### ${channelName}\n\n`;

        validMessages.forEach((message) => {
          const userName = userMap.get(message.user) || message.user;

          // Skip messages from undefined users (typically bots)
          if (userName === "undefined") {
            return;
          }

          const cleanText = cleanMessageText(message.text, userMap);

          // Format time if timestamps are enabled
          const timeStr =
            options.timestamps !== false && message.ts
              ? formatTime(message.ts)
              : "";

          // Format: time @name: message or @name: message if no timestamps
          if (timeStr) {
            markdown += `${timeStr} @${userName}: ${cleanText}\n`;
          } else {
            markdown += `@${userName}: ${cleanText}\n`;
          }
        });

        markdown += "\n";
      }
    });
  });

  return markdown;
}

/**
 * Main function
 */
function main() {
  parseArguments();
  const options = program.opts();
  const [inputFolder] = program.args;

  // Validate input folder
  if (!fs.existsSync(inputFolder)) {
    console.error(`Input folder not found: ${inputFolder}`);
    process.exit(1);
  }

  console.log("Loading users...");

  // Load users
  const usersFile = path.join(inputFolder, "users.json");
  if (!fs.existsSync(usersFile)) {
    console.error(`Users file not found: ${usersFile}`);
    process.exit(1);
  }

  const users = loadJsonFile(usersFile);
  const userMap = createUserMapping(users);

  console.log(`Loaded ${users.length} users`);

  // Load DMs
  console.log("Loading DMs...");
  const dmsFile = path.join(inputFolder, "dms.json");
  let dms = [];
  if (fs.existsSync(dmsFile)) {
    dms = loadJsonFile(dmsFile);
    console.log(`Loaded ${dms.length} DMs`);
  } else {
    console.log("No dms.json file found, skipping DM processing");
  }

  const dmMap = createDMMapping(dms, userMap);

  // Scan data folder
  console.log("Scanning data folder...");
  const messagesByMonth = scanDataFolder(inputFolder, userMap, dmMap, options);

  // Create output folder
  if (!fs.existsSync(options.output)) {
    fs.mkdirSync(options.output, { recursive: true });
  }

  // Generate markdown files for each month
  console.log("Generating markdown files...");
  let totalFiles = 0;

  for (const [monthKey, monthData] of messagesByMonth) {
    const markdown = generateMonthMarkdown(
      monthKey,
      monthData,
      userMap,
      options
    );

    // Only create file if there's actual content (check for message lines)
    const lines = markdown.trim().split("\n");
    const hasMessages = lines.some(
      (line) =>
        line.includes("@") &&
        line.includes(":") &&
        (line.match(/^\d{1,2}:\d{2}:\d{2} (AM|PM) @/) || line.match(/^@/))
    );

    if (hasMessages) {
      const outputFile = path.join(options.output, `${monthKey}.md`);
      fs.writeFileSync(outputFile, markdown, "utf8");
      console.log(`✅ Created: ${outputFile}`);
      totalFiles++;
    }
  }

  console.log(
    `\n🎉 Successfully generated ${totalFiles} monthly markdown files in: ${options.output}`
  );
}

// Run the program only when called directly, not when imported
if (require.main === module) {
  main();
}

module.exports = {
  loadJsonFile,
  createUserMapping,
  createDMMapping,
  generateMonthMarkdown,
};
