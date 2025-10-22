# 📊 Slack Export Summary

A Node.js CLI tool that converts Slack export folder structure into organized markdown files by month.

## ✨ Features

- Processes entire Slack export folder structures with channel subfolders and DM folders
- Groups conversations by month (YYYY-MM.md format)
- Maps user IDs to actual user names
- Processes both public channels and private direct messages (DMs)
- Organizes by date headings and channel/DM subheadings
- Includes timestamps and message content
- Filters out bot messages automatically
- Clean, readable output format
- Command-line interface with options

## 📦 Installation

1. Install dependencies:

```bash
npm install
```

## 🚀 Usage

### 📝 Basic Usage

```bash
node index.js <data-folder>
```

### 💡 Example

```bash
node index.js data
```

### ⚙️ Options

- `-o, --output <folder>`: Specify output folder path (default: `output`)
- `--no-timestamps`: Exclude timestamps from the output

### 🔧 Examples with Options

```bash
# Specify custom output folder
node index.js data -o monthly-summaries

# Generate without timestamps
node index.js data --no-timestamps

# Custom output folder without timestamps
node index.js data -o clean-output --no-timestamps
```

## 📁 Input Structure

The tool expects a data folder with the following structure:

```
data/
├── users.json
├── dms.json
├── channel-1/
│   ├── 2021-01-15.json
│   ├── 2021-01-16.json
│   └── 2021-02-01.json
├── channel-2/
│   ├── 2021-01-20.json
│   └── 2021-02-05.json
├── D013YJ29SSG/
│   ├── 2021-01-15.json
│   └── 2021-01-16.json
└── ...
```

### 📄 Files

- **users.json**: Contains user information for ID to name mapping
- **dms.json**: Contains DM metadata with participant information (optional)
- **Channel folders**: Each folder represents a Slack channel
- **DM folders**: Folders starting with "D" represent direct message conversations
- **Date files**: YYYY-MM-DD.json files containing messages for that date

## 📤 Output Structure

The tool generates monthly markdown files organized as follows:

```
output/
├── 2021-01.md
├── 2021-02.md
├── 2021-03.md
└── ...
```

## 📝 Output format

Each monthly file contains:

- **Month heading**: `# 2021-02`
- **Date sections**: `## February 15, 2021`
- **Channel sections**: `### channel-name`
- **DM sections**: `### DM between [name], [name]` or `### DM with [name]`
- **Messages**: `time @name: message` or `@name: message` (without timestamps)
- **Bot filtering**: Automatically excludes messages from undefined users (typically bots)

### 💡 Example output

**With timestamps:**

```markdown
# 2021-02

## February 15, 2021

### DM between John, Sarah

6:30:04 PM @John: Let's discuss the roadmap privately
6:30:11 PM @Sarah: Sounds good, what's your thinking?

### project-planning

6:30:24 PM @John: We need to prioritize feature X
6:30:35 PM @John: and then eventually scale to enterprise

### general

8:45:23 PM @Sarah: Great meeting today everyone!
```

**Without timestamps (using --no-timestamps):**

```markdown
# 2021-02

## February 15, 2021

### DM between John, Sarah

@John: Let's discuss the roadmap privately
@Sarah: Sounds good, what's your thinking?

### project-planning

@John: We need to prioritize feature X
@John: and then eventually scale to enterprise

### general

@Sarah: Great meeting today everyone!
```

## ⚡ Advanced features

- **Automatic month grouping**: Messages are automatically organized by month
- **Date organization**: Within each month, messages are grouped by date
- **Channel organization**: Within each date, messages are grouped by channel
- **DM processing**: Direct messages are processed and displayed with participant names
- **User mapping**: User IDs are converted to readable names
- **Bot filtering**: Automatically excludes messages from undefined users (typically bots)
- **Flexible output**: Choose between timestamped and non-timestamped formats
- **Scalable**: Handles large Slack exports with hundreds of channels, DMs, and thousands of messages

## 💬 DM support

The tool automatically processes direct message conversations alongside public channels:

### 🔄 DM processing

- **Automatic detection**: DM folders (starting with "D") are automatically identified and processed
- **Participant mapping**: Uses `dms.json` to map DM IDs to participant names
- **Smart naming**: DMs are displayed as:
  - `DM between [name], [name]` for multi-participant conversations
  - `DM with [name]` for single-participant conversations
- **Fallback handling**: If `dms.json` is missing, DM folders are still processed with fallback names

### 📁 DM file structure

```
data/
├── dms.json                    # DM metadata (optional)
├── D013YJ29SSG/               # DM folder (ID format)
│   ├── 2021-01-15.json
│   └── 2021-01-16.json
└── D014G80A4Q0/               # Another DM folder
    └── 2021-01-20.json
```

### 💡 DM output example

```markdown
### DM between Anand, Carlo

8:20:51 PM @Anand: Let's discuss the project privately
8:21:15 PM @Carlo: Sounds good, what's your thinking?

### DM with Brex

9:46:38 AM @Brex: Your card was charged: $149.00 USD
```

## 🧪 Testing

The project includes comprehensive tests using Jest:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### 📊 Test coverage

- **Unit tests**: Test individual functions like user mapping, text cleaning, and markdown generation
- **Integration tests**: Test the complete CLI workflow with real file structures
- **Error handling**: Test edge cases like missing files, invalid JSON, and empty directories

### 🔄 Continuous integration

GitHub Actions workflows are configured to automatically run tests on:

- **Push** to main/master branches
- **Pull requests** to main/master branches

The CI runs tests on multiple Node.js versions (18.x and 20.x) and generates coverage reports.

## 🤖 AI summarization

The tool includes AI-powered summarization capabilities using OpenAI's API to generate comprehensive summaries of monthly conversations.

### 🚀 Usage

```bash
# Generate summaries for ALL months (requires confirmation)
npm run summarize
```

### 📋 Requirements

- OpenAI API key (set as `OPEN_API_KEY` environment variable)
- Monthly markdown files generated by the main CLI tool

### ⚙️ Setup

1. Create a `.env` file in the project root:

```bash
OPEN_API_KEY=your_openai_api_key_here
```

2. The script will automatically load the API key and provide helpful error messages if it's missing.

### 📤 Output

The summarization creates a `summary.md` file containing:

- AI-generated summaries for each month
- Chronological organization
- Key discussions, decisions, and themes
- Professional formatting with month headings

### 💰 Cost estimation

- **Small export** (3 months): ~$0.45 - $0.90
- **Full processing** (all months): Varies based on conversation volume
- Uses GPT-5-mini for cost efficiency

## 📄 License

MIT
