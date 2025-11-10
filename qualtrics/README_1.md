# Qualtrics Question JavaScript

This directory contains the JavaScript code for the Chatroom experiment Qualtrics survey. These scripts handle the complete workflow from group assignment through chat completion.

## Overview

The chatroom experiment uses a sequential flow of JavaScript-enhanced Qualtrics questions to:
1. **Match** participants to groups and roles via AWS Lambda
2. **Welcome** participants and configure their session
3. **Chat** in real-time using backend polling
4. **Report** the complete transcript
5. **Complete** the session and notify the backend

All scripts communicate with the AWS Lambda backend at the URL specified in `serverURL` embedded data.

## Files

### JavaScript Snippets

**1. `Matching.js`**
- **Question ID**: QID29
- **Question Name**: Matching
- **Lines**: 31
- **Purpose**: Initial group assignment lookup
- **Description**: Fetches `groupID` and `participantRole` from the AWS Lambda `/individual_group_matching` endpoint using the participant's `experimentalUnitID`. Sets `chat_ready` flag to "1" on success.

**2. `Welcome.js`**
- **Question ID**: QID24
- **Question Name**: Welcome
- **Lines**: 48
- **Purpose**: Pre-chat configuration and timezone detection
- **Description**: Detects the participant's IANA timezone (e.g., "America/Chicago") and saves it to `chatTimeZone` embedded data. Also suppresses harmless theme-related console errors during this page only.

**3. `Chat.js`**
- **Question ID**: QID13
- **Question Name**: Chat
- **Lines**: 214
- **Attribution**: Inspired by SMARTRIQS (A. Molnar, 2019)
- **Purpose**: Real-time chat interface
- **Description**: The main chat page that:
  - Polls the backend every second for new messages
  - Sends participant messages via POST requests
  - Displays a countdown timer (if `chatDuration` is set)
  - Provides optional early exit button (if `allowExitChat` is "yes")
  - Supports configurable chat window dimensions
  - Handles timezone-aware timestamp display

**4. `Report.js`**
- **Question ID**: QID27
- **Question Name**: Report
- **Lines**: 114
- **Purpose**: Transcript display and archival
- **Description**: Fetches the complete chat transcript as JSON from the backend, saves it to `chatLog` embedded data, and renders a formatted view on the page with timestamps and participant roles.

**5. `Complete.js`**
- **Question ID**: QID12
- **Question Name**: Complete
- **Lines**: 19
- **Attribution**: Inspired by SMARTRIQS (A. Molnar, 2019)
- **Purpose**: Session completion notification
- **Description**: Notifies the backend via `/complete` endpoint that the participant has finished the experiment, then advances to the next page.


## Workflow Sequence

```
1. Matching.js
   └─> Calls GET /individual_group_matching
       Sets: groupID, participantRole, chat_ready

2. Welcome.js
   └─> Detects timezone
       Sets: chatTimeZone

3. Chat.js
   └─> Polls GET /chat (mode=0) every 1 second
   └─> Sends POST /chat (mode=2) on message submit
       Uses: groupID, participantRole, chatName

4. Report.js
   └─> Calls GET /chat (mode=0, export=1, format=json)
       Sets: chatLog, chatLogCount

5. Complete.js
   └─> Calls POST /complete
       Uses: groupID, ResponseID
```

## Usage in Qualtrics

To deploy these scripts to your Qualtrics survey:

1. **Open your survey** in Qualtrics Survey Builder
2. **Navigate to the question** you want to add JavaScript to
3. **Click the gear icon** (⚙️) → "JavaScript"
4. **Copy the code** from the corresponding `.js` file:
   - **Skip the header comment block** (lines 1-7 starting with `/**`)
   - Copy everything else, including the footer comments
5. **Paste into the JavaScript editor** in Qualtrics
6. **Save** and test in Preview mode


## Required Embedded Data Fields

These embedded data fields must be set before the chat sequence begins:

### Set by Researcher (in Survey Flow)
- `serverURL` - AWS API Gateway base URL (e.g., `https://kr98xfirp7.execute-api.us-east-1.amazonaws.com/default`)
- `experimentalUnitID` - Unique identifier for the participant (often from Prolific or other recruitment)
- `chatName` - Name of the chat room (default: "Main")
- `typed_name` - Participant's display name (collected in earlier question)

### Optional Configuration
- `chatDuration` - Chat duration in seconds (e.g., 300 for 5 minutes)
- `allowExitChat` - Enable early exit button ("yes" or "no", default: "no")
- `chatWindowWidth` - Chat window width in pixels (default: 600, range: 400-1200)
- `chatWindowHeight` - Chat window height in pixels (default: 360, range: 240-720)
- `chatInstructions` - Custom instructions text for the chat page
- `chatShowTime` - Show timestamps in chat ("yes" or "no", default: "no")
- `chatTimeFormat` - Time format ("hm24", "hms24", etc., default: "hm24")

### Set Automatically by Scripts
- `groupID` - Assigned by Matching.js
- `participantRole` - Assigned by Matching.js
- `chat_ready` - Flag indicating successful matching ("1" or "0")
- `chatTimeZone` - Detected by Welcome.js (e.g., "America/Chicago")
- `chatLog` - JSON transcript saved by Report.js
- `chatLogCount` - Number of messages, saved by Report.js
- `ResponseID` - Qualtrics built-in field used by Complete.js


## Survey Flow Setup

### Importing the Survey

To set up the complete survey with proper flow logic and embedded data:

1. **Import the .qsf file** into Qualtrics:
   - Go to Qualtrics → Projects
   - Click **"Create Project"** → **"Survey"** → **"From a file"**
   - Upload `Chatroom-asw_matching_final.qsf`
   - Click **"Get Started"**

2. **Review the Survey Flow**:
   - Open the survey → Click **"Survey Flow"** in the left sidebar
   - You'll see the complete logic including:
     - Embedded Data field declarations
     - Question blocks in correct order
     - Branch logic (if any)
     - Randomization settings (if any)

### Survey Flow Structure

The survey flow should include these key elements in order:

1. **Embedded Data (Set at Start)**
   - `serverURL` - Your AWS API Gateway URL
   - `experimentalUnitID` - Participant identifier (e.g., from Prolific)
   - `chatName` - Chat room name (default: "Main")
   - Optional configuration fields (chatDuration, allowExitChat, etc.)

2. **Question Blocks**
   - **Matching Block** - Runs Matching.js to assign group/role
   - **Welcome Block** - Runs Welcome.js to configure session
   - **Chat Block** - Runs Chat.js for real-time interaction
   - **Report Block** - Runs Report.js to display transcript
   - **Complete Block** - Runs Complete.js to finalize session

3. **Embedded Data (Capture at End)**
   - `groupID` - Captured for data export
   - `participantRole` - Captured for data export
   - `chatLog` - Captured for data export
   - `chatLogCount` - Captured for data export
   - `chatTimeZone` - Captured for data export

### Configuring Embedded Data

**Before deploying**, edit the Survey Flow to set these values:
```
Survey Flow:
├─ Embedded Data
│  ├─ serverURL = "https://your-api.execute-api.us-east-1.amazonaws.com/default"
│  ├─ experimentalUnitID = "${e://Field/PROLIFIC_PID}" (or your ID source)
│  ├─ chatName = "Main"
│  ├─ chatDuration = "300" (optional: 5 minutes)
│  └─ [other optional fields...]
├─ Block: Matching
├─ Block: Welcome
├─ Block: Chat
├─ Block: Report
├─ Block: Complete
└─ Embedded Data (capture)
   ├─ groupID = "${e://Field/groupID}"
   ├─ participantRole = "${e://Field/participantRole}"
   ├─ chatLog = "${e://Field/chatLog}"
   └─ [other fields to capture...]
```

### Important Notes

- **Don't skip the import**: The .qsf file contains critical Survey Flow logic that isn't visible in the JavaScript files alone

- **Piped text**: Some questions use piped text (e.g., `${e://Field/typed_name}`) which requires proper flow setup. 

### Setup Steps:

1. Create a new blank survey
2. Add 5 questions (one for each .js file)
3. Copy JavaScript from the .js files into each question
4. **Manually configure Survey Flow** with all embedded data fields
5. Set the question display order: Matching → Welcome → Chat → Report → Complete


