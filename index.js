#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { program } = require("commander");

/**
 * Parse command line arguments
 */
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
function scanDataFolder(inputFolder, userMap, options) {
  const messagesByMonth = new Map();
  const usersFile = path.join(inputFolder, "users.json");

  if (!fs.existsSync(usersFile)) {
    console.error(`Users file not found: ${usersFile}`);
    process.exit(1);
  }

  // Read all channel folders
  const items = fs.readdirSync(inputFolder, { withFileTypes: true });
  const channelFolders = items
    .filter((item) => item.isDirectory())
    .map((item) => item.name);

  console.log(
    `Found ${channelFolders.length} channels: ${channelFolders.join(", ")}`
  );

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
  const users = loadJsonFile(usersFile);
  const userMap = createUserMapping(users);

  console.log(`Loaded ${users.length} users`);

  // Scan data folder
  console.log("Scanning data folder...");
  const messagesByMonth = scanDataFolder(inputFolder, userMap, options);

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
    const outputFile = path.join(options.output, `${monthKey}.md`);

    fs.writeFileSync(outputFile, markdown, "utf8");
    console.log(`✅ Created: ${outputFile}`);
    totalFiles++;
  }

  console.log(
    `\n🎉 Successfully generated ${totalFiles} monthly markdown files in: ${options.output}`
  );
}

// Run the program
if (require.main === module) {
  main();
}

module.exports = { loadJsonFile, createUserMapping, generateMonthMarkdown };
