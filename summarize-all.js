#!/usr/bin/env node

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { OpenAI } = require("openai");

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
 * Generate summary for a single month using OpenAI API
 */
async function generateMonthSummary(monthFile, outputDir) {
  const footerPath = path.join(outputDir, monthFile);
  const content = fs.readFileSync(footerPath, "utf8");

  // Extract month name from filename (e.g., "2021-02.md" -> "February 2021")
  const [year, month] = monthFile.replace(".md", "").split("-");
  const monthName = new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

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
          content: `Here is the Slack conversation for ${monthName}:\n\n${content}`,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent summaries
      max_tokens: 2000, // Limit tokens to control costs
    });

    const summary = completion.choices[0].message.content.trim();

    // If the summary is empty or just whitespace, return a placeholder
    if (!summary || summary.length < 10) {
      return `## ${monthName}\n\nNo significant activity recorded for this month.`;
    }

    return `## ${monthName}\n\n${summary}`;
  } catch (error) {
    console.error(`❌ Error summarizing ${monthName}:`, error.message);
    return `## ${monthName}\n\nError generating summary: ${error.message}`;
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

  console.log(`📊 Found ${monthlyFiles.length} monthly files to process`);
  console.log(
    `⚠️  This will make ${
      monthlyFiles.length
    } API calls to OpenAI. Estimated cost: $${(
      monthlyFiles.length * 0.15
    ).toFixed(2)} - $${(monthlyFiles.length * 0.3).toFixed(2)}`
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

  // Process each month
  for (const monthFile of monthlyFiles) {
    const summary = await generateMonthSummary(monthFile, outputDir);
    summaries.push(summary);
    processed++;

    console.log(`✅ Completed ${processed}/${monthlyFiles.length} months`);

    // Add a small delay to be respectful to the API
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Combine all summaries into a single document
  const combinedSummary = [
    "# Company Conversation Summary",
    "",
    "This document contains AI-generated summaries of monthly Slack conversations, ",
    "providing insights into the company's journey, decisions, and key discussions.",
    "",
    "Generated on: " + new Date().toISOString(),
    "Total months processed: " + monthlyFiles.length,
    "",
    ...summaries,
  ].join("\n");

  // Write the combined summary
  const summaryPath = path.join(__dirname, "summary.md");
  fs.writeFileSync(summaryPath, combinedSummary, "utf8");

  console.log(`\n✅ Successfully generated comprehensive summary!`);
  console.log(`📄 Summary saved to: ${summaryPath}`);
  console.log(`📊 Processed ${processed} months`);
  console.log(
    `💰 Estimated total cost: $${(processed * 0.15).toFixed(2)} - $${(
      processed * 0.3
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

module.exports = { generateMonthSummary, getMonthlyFiles, main };
