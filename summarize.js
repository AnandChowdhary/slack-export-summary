#!/usr/bin/env node

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");

// Check if API key is available
if (!process.env.OPEN_API_KEY) {
  console.error("❌ Error: OPEN_API_KEY environment variable is not set.");
  console.error("Please create a .env file with your OpenAI API key:");
  console.error("OPEN_API_KEY=your_api_key_here");
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPEN_API_KEY,
});

/**
 * Read and parse the system prompt from prompt.md
 */
function getSystemPrompt() {
  const promptPath = path.join(__dirname, "prompt.md");
  return fs.readFileSync(promptPath, "utf8");
}

/**
 * Get all monthly markdown files from the output directory
 */
function getMonthlyFiles(outputDir) {
  const files = fs.readdirSync(outputDir);
  return files
    .filter((file) => file.endsWith(".md") && /^\d{4}-\d{2}\.md$/.test(file))
    .sort(); // Sort chronologically
}

/**
 * Get cache directory path
 */
function getCacheDir() {
  const cacheDir = path.join(__dirname, "cache");
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

/**
 * Get cache file path for a specific month
 */
function getCacheFilePath(monthFile) {
  const cacheDir = getCacheDir();
  return path.join(cacheDir, monthFile.replace(".md", ".json"));
}

/**
 * Check if cached summary exists and is valid
 */
function getCachedSummary(monthFile) {
  const cacheFilePath = getCacheFilePath(monthFile);

  if (!fs.existsSync(cacheFilePath)) {
    return null;
  }

  try {
    const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, "utf8"));

    // Check if cache is recent (within 7 days) and has valid content
    const cacheAge = Date.now() - cacheData.timestamp;
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

    if (cacheAge > maxAge) {
      console.log(`🗑️  Cache expired for ${monthFile}, will regenerate`);
      return null;
    }

    if (!cacheData.summary || cacheData.summary.length < 10) {
      console.log(`🗑️  Invalid cache for ${monthFile}, will regenerate`);
      return null;
    }

    return cacheData.summary;
  } catch (error) {
    console.log(`🗑️  Corrupted cache for ${monthFile}, will regenerate`);
    return null;
  }
}

/**
 * Save summary to cache
 */
function saveToCache(monthFile, summary) {
  const cacheFilePath = getCacheFilePath(monthFile);
  const cacheData = {
    timestamp: Date.now(),
    monthFile: monthFile,
    summary: summary,
    model: "gpt-5-mini",
  };

  fs.writeFileSync(cacheFilePath, JSON.stringify(cacheData, null, 2), "utf8");
}

/**
 * Split month content into first and second half
 */
function splitMonthContent(content) {
  const lines = content.split("\n");
  const midPoint = Math.floor(lines.length / 2);

  // Find a good split point (preferably at a date boundary)
  let splitIndex = midPoint;
  for (let i = midPoint; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      splitIndex = i;
      break;
    }
  }

  const firstHalf = lines.slice(0, splitIndex).join("\n");
  const secondHalf = lines.slice(splitIndex).join("\n");

  return { firstHalf, secondHalf };
}

/**
 * Split month content into four quarters
 */
function splitMonthContentIntoFour(content) {
  const lines = content.split("\n");
  const quarterSize = Math.floor(lines.length / 4);

  // Find good split points (preferably at date boundaries)
  const splitPoints = [];

  for (let quarter = 1; quarter < 4; quarter++) {
    const targetIndex = quarter * quarterSize;
    let splitIndex = targetIndex;

    // Look for a good split point around the target index
    for (
      let i = targetIndex;
      i < Math.min(targetIndex + quarterSize, lines.length);
      i++
    ) {
      if (lines[i].startsWith("## ")) {
        splitIndex = i;
        break;
      }
    }

    splitPoints.push(splitIndex);
  }

  const quarters = [
    lines.slice(0, splitPoints[0]).join("\n"),
    lines.slice(splitPoints[0], splitPoints[1]).join("\n"),
    lines.slice(splitPoints[1], splitPoints[2]).join("\n"),
    lines.slice(splitPoints[2]).join("\n"),
  ];

  return quarters;
}

/**
 * Combine two summaries into one cohesive summary
 */
async function combineSummaries(firstSummary, secondSummary, monthName) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that combines two summaries of the same month into one cohesive summary. Merge the key points, remove duplicates, and create a unified narrative that flows well.",
        },
        {
          role: "user",
          content: `Please combine these two summaries for ${monthName} into one comprehensive summary:\n\nFirst half summary:\n${firstSummary}\n\nSecond half summary:\n${secondSummary}`,
        },
      ],
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error(
      `❌ Error combining summaries for ${monthName}:`,
      error.message
    );
    // Fallback: just concatenate the summaries
    return `${firstSummary}\n\n${secondSummary}`;
  }
}

/**
 * Combine four summaries into one cohesive summary
 */
async function combineFourSummaries(summaries, monthName) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that combines four summaries of the same month into one cohesive summary. Merge the key points, remove duplicates, and create a unified narrative that flows well chronologically.",
        },
        {
          role: "user",
          content: `Please combine these four summaries for ${monthName} into one comprehensive summary:\n\nFirst quarter summary:\n${summaries[0]}\n\nSecond quarter summary:\n${summaries[1]}\n\nThird quarter summary:\n${summaries[2]}\n\nFourth quarter summary:\n${summaries[3]}`,
        },
      ],
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error(
      `❌ Error combining four summaries for ${monthName}:`,
      error.message
    );
    // Fallback: just concatenate the summaries
    return summaries.join("\n\n");
  }
}

/**
 * Generate a one-sentence summary for a month
 */
async function generateOneSentenceSummary(monthFile, fullSummary) {
  const cacheFilePath = getCacheFilePath(monthFile);
  const oneSentenceCachePath = cacheFilePath.replace(
    ".json",
    "-onesentence.json"
  );

  // Check if one-sentence summary is cached
  if (fs.existsSync(oneSentenceCachePath)) {
    try {
      const cacheData = JSON.parse(
        fs.readFileSync(oneSentenceCachePath, "utf8")
      );
      const cacheAge = Date.now() - cacheData.timestamp;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      if (cacheAge <= maxAge && cacheData.oneSentenceSummary) {
        console.log(`💾 Using cached one-sentence summary for ${monthFile}`);
        return cacheData.oneSentenceSummary;
      }
    } catch (error) {
      console.log(
        `🗑️  Corrupted one-sentence cache for ${monthFile}, will regenerate`
      );
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that creates concise one-sentence summaries. Create a single, clear sentence that captures the most important events, decisions, or themes from the given month's summary. Focus on the most significant developments or outcomes.",
        },
        {
          role: "user",
          content: `Please create a one-sentence summary of this month's activities:\n\n${fullSummary}`,
        },
      ],
    });

    const oneSentenceSummary = completion.choices[0].message.content.trim();

    // Save to cache
    const cacheData = {
      timestamp: Date.now(),
      monthFile: monthFile,
      oneSentenceSummary: oneSentenceSummary,
      model: "gpt-5-mini",
    };
    fs.writeFileSync(
      oneSentenceCachePath,
      JSON.stringify(cacheData, null, 2),
      "utf8"
    );

    return oneSentenceSummary;
  } catch (error) {
    console.error(
      `❌ Error generating one-sentence summary for ${monthFile}:`,
      error.message
    );
    return "Unable to generate summary.";
  }
}

/**
 * Generate summary for a single month using OpenAI API
 */
async function generateMonthSummary(monthFile, outputDir) {
  const filePath = path.join(outputDir, monthFile);
  const content = fs.readFileSync(filePath, "utf8");

  // Extract month name from filename (e.g., "2021-02.md" -> "February 2021")
  const [year, month] = monthFile.replace(".md", "").split("-");
  const monthName = new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Check cache first
  const cachedSummary = getCachedSummary(monthFile);
  if (cachedSummary) {
    console.log(`💾 Using cached summary for ${monthName}`);

    // Generate one-sentence summary for cached content
    console.log(`📝 Generating one-sentence summary for ${monthName}...`);
    const oneSentenceSummary = await generateOneSentenceSummary(
      monthFile,
      cachedSummary
    );

    // Add tl;dr section to cached summary
    const summaryWithTldr = cachedSummary.replace(
      `## ${monthName}\n\n`,
      `## ${monthName}\n\n**tl;dr:** ${oneSentenceSummary}\n\n`
    );

    return summaryWithTldr;
  }

  console.log(`📝 Summarizing ${monthName}...`);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini", // Using the more cost-effective model
      messages: [
        {
          role: "system",
          content: getSystemPrompt(),
        },
        {
          role: "user",
          content: `# ${monthName}\n\n${content}`,
        },
      ],
    });

    const summary = completion.choices[0].message.content.trim();

    // If the summary is empty or just whitespace, return a placeholder
    if (!summary || summary.length < 10) {
      const placeholder = `## ${monthName}\n\nNo significant activity recorded for this month.`;
      saveToCache(monthFile, placeholder);
      return placeholder;
    }

    const formattedSummary = `## ${monthName}\n\n${summary}`;

    // Generate one-sentence summary
    console.log(`📝 Generating one-sentence summary for ${monthName}...`);
    const oneSentenceSummary = await generateOneSentenceSummary(
      monthFile,
      formattedSummary
    );

    // Add tl;dr section to the summary
    const summaryWithTldr = formattedSummary.replace(
      `## ${monthName}\n\n`,
      `## ${monthName}\n\n**tl;dr:** ${oneSentenceSummary}\n\n`
    );

    // Save to cache (without tl;dr to keep original format)
    saveToCache(monthFile, formattedSummary);
    console.log(`💾 Cached summary for ${monthName}`);

    return summaryWithTldr;
  } catch (error) {
    // Check if this is a token limit error
    if (
      error.message.includes("Input tokens exceed") ||
      error.message.includes("token limit")
    ) {
      console.log(
        `⚠️  Token limit exceeded for ${monthName}, splitting into two parts...`
      );

      try {
        const { firstHalf, secondHalf } = splitMonthContent(content);

        console.log(`📝 Summarizing first half of ${monthName}...`);
        const firstCompletion = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content: getSystemPrompt(),
            },
            {
              role: "user",
              content: `# ${monthName} (First Half)\n\n${firstHalf}`,
            },
          ],
        });

        console.log(`📝 Summarizing second half of ${monthName}...`);
        const secondCompletion = await openai.chat.completions.create({
          model: "gpt-5-mini",
          messages: [
            {
              role: "system",
              content: getSystemPrompt(),
            },
            {
              role: "user",
              content: `# ${monthName} (Second Half)\n\n${secondHalf}`,
            },
          ],
        });

        const firstSummary = firstCompletion.choices[0].message.content.trim();
        const secondSummary =
          secondCompletion.choices[0].message.content.trim();

        console.log(`🔗 Combining summaries for ${monthName}...`);
        const combinedSummary = `${firstSummary}${secondSummary}`;
        const formattedSummary = `## ${monthName}\n\n${combinedSummary}`;

        // Generate one-sentence summary
        console.log(`📝 Generating one-sentence summary for ${monthName}...`);
        const oneSentenceSummary = await generateOneSentenceSummary(
          monthFile,
          formattedSummary
        );

        // Add tl;dr section to the summary
        const summaryWithTldr = formattedSummary.replace(
          `## ${monthName}\n\n`,
          `## ${monthName}\n\n**tl;dr:** ${oneSentenceSummary}\n\n`
        );

        // Save to cache (without tl;dr to keep original format)
        saveToCache(monthFile, formattedSummary);
        console.log(`💾 Cached combined summary for ${monthName}`);

        return summaryWithTldr;
      } catch (splitError) {
        // If 2-part splitting also fails due to token limits, try 4-part splitting
        if (
          splitError.message.includes("Input tokens exceed") ||
          splitError.message.includes("token limit")
        ) {
          console.log(
            `⚠️  Two-part splitting also exceeded token limit for ${monthName}, trying four-part splitting...`
          );

          try {
            const quarters = splitMonthContentIntoFour(content);
            const quarterSummaries = [];

            // Generate summaries for each quarter
            for (let i = 0; i < quarters.length; i++) {
              const quarterNames = ["first", "second", "third", "fourth"];
              console.log(
                `📝 Summarizing ${quarterNames[i]} quarter of ${monthName}...`
              );

              const quarterCompletion = await openai.chat.completions.create({
                model: "gpt-5-mini",
                messages: [
                  {
                    role: "system",
                    content: getSystemPrompt(),
                  },
                  {
                    role: "user",
                    content: `# ${monthName} (${
                      quarterNames[i].charAt(0).toUpperCase() +
                      quarterNames[i].slice(1)
                    } Quarter)\n\n${quarters[i]}`,
                  },
                ],
              });

              quarterSummaries.push(
                quarterCompletion.choices[0].message.content.trim()
              );
            }

            console.log(`🔗 Combining four summaries for ${monthName}...`);
            const combinedSummary = await combineFourSummaries(
              quarterSummaries,
              monthName
            );
            const formattedSummary = `## ${monthName}\n\n${combinedSummary}`;

            // Generate one-sentence summary
            console.log(
              `📝 Generating one-sentence summary for ${monthName}...`
            );
            const oneSentenceSummary = await generateOneSentenceSummary(
              monthFile,
              formattedSummary
            );

            // Add tl;dr section to the summary
            const summaryWithTldr = formattedSummary.replace(
              `## ${monthName}\n\n`,
              `## ${monthName}\n\n**tl;dr:** ${oneSentenceSummary}\n\n`
            );

            // Save to cache (without tl;dr to keep original format)
            saveToCache(monthFile, formattedSummary);
            console.log(
              `💾 Cached four-part combined summary for ${monthName}`
            );

            return summaryWithTldr;
          } catch (fourPartError) {
            console.error(
              `❌ Error summarizing four-part content for ${monthName}:`,
              fourPartError.message
            );
            return `## ${monthName}\n\nError generating summary: ${fourPartError.message}`;
          }
        } else {
          console.error(
            `❌ Error summarizing split content for ${monthName}:`,
            splitError.message
          );
          return `## ${monthName}\n\nError generating summary: ${splitError.message}`;
        }
      }
    } else {
      console.error(`❌ Error summarizing ${monthName}:`, error.message);
      return `## ${monthName}\n\nError generating summary: ${error.message}`;
    }
  }
}

/**
 * Main function to generate comprehensive summary for ALL months
 */
async function main() {
  const outputDir = path.join(__dirname, "output");

  if (!fs.existsSync(outputDir)) {
    console.error(
      "❌ Output directory not found. Please run the main CLI first to generate monthly files."
    );
    process.exit(1);
  }

  console.log(
    "🚀 Starting comprehensive conversation summarization for ALL months...\n"
  );

  // Get all monthly files
  const monthlyFiles = getMonthlyFiles(outputDir);

  if (monthlyFiles.length === 0) {
    console.error("❌ No monthly markdown files found in output directory.");
    process.exit(1);
  }

  console.log(`📊 Found ${monthlyFiles.length} monthly files`);

  // Check cache status
  let cachedCount = 0;
  let needsApiCallCount = 0;

  for (const monthFile of monthlyFiles) {
    const cachedSummary = getCachedSummary(monthFile);
    if (cachedSummary) {
      cachedCount++;
    } else {
      needsApiCallCount++;
    }
  }

  console.log(`💾 ${cachedCount} months already cached`);
  console.log(`📝 ${needsApiCallCount} months need API calls`);
  console.log(
    `⚠️  This will make ${needsApiCallCount} API calls to OpenAI. Estimated cost: $${(
      needsApiCallCount * 0.15
    ).toFixed(2)} - $${(needsApiCallCount * 0.3).toFixed(2)}`
  );

  // Ask for confirmation
  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise((resolve) => {
    rl.question("Do you want to continue? (y/N): ", resolve);
  });
  rl.close();

  if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
    console.log("❌ Operation cancelled.");
    process.exit(0);
  }

  const summaries = [];
  let processed = 0;
  let apiCallsMade = 0;
  const summaryPath = path.join(__dirname, "summary.md");

  // Initialize the summary file with header
  const header = [
    "# Company Conversation Summary",
    "",
    "This document contains AI-generated summaries of monthly Slack conversations, ",
    "providing insights into the company's journey, decisions, and key discussions.",
    "",
    "Generated on: " + new Date().toISOString(),
    "Total months to process: " + monthlyFiles.length,
    "",
  ].join("\n");

  fs.writeFileSync(summaryPath, header, "utf8");
  console.log("📄 Initialized summary.md file");

  // Process each month
  for (const monthFile of monthlyFiles) {
    const wasCached = getCachedSummary(monthFile) !== null;
    const summary = await generateMonthSummary(monthFile, outputDir);
    summaries.push(summary);
    processed++;

    // Track API calls made
    if (!wasCached) {
      apiCallsMade++;
    }

    // Append this month's summary to the file immediately
    fs.appendFileSync(summaryPath, summary + "\n\n", "utf8");

    console.log(
      `✅ Completed ${processed}/${monthlyFiles.length} months - written to summary.md`
    );

    // Add a small delay to be respectful to the API (only for actual API calls)
    if (!wasCached) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Update the header with final count
  const finalHeader = [
    "# Company Conversation Summary",
    "",
    "This document contains AI-generated summaries of monthly Slack conversations, ",
    "providing insights into the company's journey, decisions, and key discussions.",
    "",
    "Generated on: " + new Date().toISOString(),
    "Total months processed: " + processed,
    "",
  ].join("\n");

  // Read current content and replace header
  const currentContent = fs.readFileSync(summaryPath, "utf8");
  const contentWithoutHeader = currentContent.substring(header.length);
  const finalContent = finalHeader + contentWithoutHeader;

  fs.writeFileSync(summaryPath, finalContent, "utf8");

  console.log(`\n✅ Successfully generated comprehensive summary!`);
  console.log(`📄 Summary saved to: ${summaryPath}`);
  console.log(`📊 Processed ${processed} months`);
  console.log(`💾 Used ${cachedCount} cached summaries`);
  console.log(`📝 Made ${apiCallsMade} new API calls`);
  console.log(
    `💰 Estimated cost for this run: $${(apiCallsMade * 0.15).toFixed(2)} - $${(
      apiCallsMade * 0.3
    ).toFixed(2)}`
  );
}

// Run the script
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

module.exports = {
  generateMonthSummary,
  generateOneSentenceSummary,
  getMonthlyFiles,
  main,
  getCacheDir,
  getCacheFilePath,
  getCachedSummary,
  saveToCache,
  splitMonthContent,
  splitMonthContentIntoFour,
  combineSummaries,
  combineFourSummaries,
};
