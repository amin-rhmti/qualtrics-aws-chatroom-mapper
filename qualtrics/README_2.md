## API Endpoints Used

All endpoints are relative to the `serverURL` base:

### GET /individual_group_matching
**Used by**: Matching.js  
**Parameters**: `experimentalUnitID`  
**Returns**: `{ groupID, participantRole }`  
**Purpose**: Assigns participant to a group and role based on the CSV mapping

### GET /chat
**Used by**: Chat.js (polling), Report.js (transcript)  
**Parameters**:
- `groupID` - The assigned group
- `participantRole` - The assigned role
- `chatName` - Chat room name
- `mode` - "0" for refresh/poll
- `export` - "1" to get full JSON (Report.js only)
- `format` - "json" for structured data (Report.js only)
- `chatTimeFormat` - Time display format (Chat.js)
- `timeZone` - IANA timezone (Chat.js)

**Returns**: 
- Poll mode: `{ chat: "<html>", count: N }`
- Export mode: `{ chatLogJSON: "[...]", count: N }`

### POST /chat
**Used by**: Chat.js (sending messages)  
**Parameters**: Same as GET, plus:
- `mode` - "2" for send
- `addText` - Message text to send

**Returns**: `{ chat: "<html>", count: N }`

### POST /complete
**Used by**: Complete.js  
**Parameters**:
- `groupID` - The assigned group
- `participantID` - Qualtrics ResponseID

**Purpose**: Marks the session as complete in DynamoDB

See the [backend documentation](../lambda/individual_group_matching.py) for implementation details.

## Configuration Examples

### Basic Setup (5-minute chat)
```javascript
// In Survey Flow, set these Embedded Data fields:
serverURL = "https://kr98xfirp7.execute-api.us-east-1.amazonaws.com/default"
experimentalUnitID = "${e://Field/PROLIFIC_PID}"
chatName = "Main"
chatDuration = "300"
```

### Advanced Setup (custom dimensions, exit button, timestamps)
```javascript
serverURL = "https://your-api.execute-api.us-east-1.amazonaws.com/default"
experimentalUnitID = "${e://Field/PROLIFIC_PID}"
chatName = "Main"
chatDuration = "600"
allowExitChat = "yes"
chatWindowWidth = "800"
chatWindowHeight = "480"
chatShowTime = "yes"
chatTimeFormat = "hms24"
chatInstructions = "Please chat naturally with your partner."
```

## SMARTRIQS Attribution

Two files (`Chat.js` and `Complete.js`) include attribution to SMARTRIQS:

```javascript
/* Inspired by SMARTRIQS (A. Molnar, 2019). Thanks for the original idea. */
```

**SMARTRIQS** is a framework for real-time group interactions in online surveys developed by Alain Molnar. Our implementation builds on these foundational concepts for chatroom-based experiments.

Learn more: https://github.com/Howquez/SMARTRIQS

## Error Handling

### Common Issues

**"Setting up the chat… waiting for group assignment"**
- **Cause**: Missing `serverURL`, `groupID`, `participantRole`, or `chat_ready` flag
- **Solution**: Ensure Matching.js completed successfully on the previous page

**"Mapping failed"**
- **Cause**: The experimentalUnitID is not in the CSV, or the backend returned an error
- **Solution**: Check that your CSV includes the ID and is properly deployed to Lambda

**"Transcript could not be loaded"**
- **Cause**: Backend error when fetching the chat transcript
- **Solution**: Check CloudWatch logs for the Lambda function

### Debugging Tips

1. **Open browser console** (F12) to see debug messages
2. **Check Network tab** to verify API calls
3. **Review embedded data** in Qualtrics survey data
4. **Check CloudWatch logs** for Lambda errors

## File Structure

Each JavaScript file includes:

1. **Header comment block** (lines 1-7)
   - Question metadata for documentation
   - **Do not paste this into Qualtrics**

2. **Main JavaScript code** (line 9 onwards)
   - The actual executable code
   - **This is what goes into Qualtrics**

3. **Project documentation comment** (near end)
   ```javascript
   /* Project documentation: https://github.com/amin-rhmti/qualtrics-aws-chatroom-mapper */
   ```

4. **SMARTRIQS attribution** (if present, final line)
   ```javascript
   /* Inspired by SMARTRIQS (A. Molnar, 2019). Thanks for the original idea. */
   ```

## Development Workflow

To modify these scripts:

1. **Edit in Qualtrics Survey Builder**
   - Make changes directly in the JavaScript editor
   - Test thoroughly in Preview mode

2. **Export the survey**
   - Download as `.qsf` file

3. **Extract updated scripts**
   - Use the extraction tool to regenerate this directory
   - Review changes with `git diff`

4. **Commit and document**
   - Commit to version control with clear change descriptions
   - Update this README if adding new features

## Testing

Before deploying to production:

1. **Test in Qualtrics Preview mode** with test IDs
2. **Verify AWS backend** is responding correctly
3. **Check embedded data** is being set properly
4. **Test error scenarios** (missing IDs, network failures)
5. **Verify transcript saving** in Report.js
6. **Test completion notification** in Complete.js

See [TESTING.md](../docs/TESTING.md) for comprehensive testing procedures.

## Architecture

```
Qualtrics Survey (Frontend)
├── Matching.js      → GET /individual_group_matching
├── Welcome.js       → (no backend calls)
├── Chat.js          → GET/POST /chat
├── Report.js        → GET /chat (export mode)
└── Complete.js      → POST /complete
                        ↓
                  API Gateway
                        ↓
              AWS Lambda (Python)
              /var/task/individual_group_matching.py
                        ↓
         ┌──────────────┼──────────────┐
         ↓              ↓              ↓
    CSV (in-memory)  DynamoDB      DynamoDB
    Group mappings   ChatEvents    MapperWrites
```

See [ARCHITECTURE.md](../docs/ARCHITECTURE.md) for detailed system design.

## Extraction Details

**Source**: `Chatroom-asw_matching_final.qsf`  
**Extracted**: 2025-11-10  
**Total Files**: 5 JavaScript snippets  
**Total Lines**: 466 (including headers and comments)

These files were extracted using an automated build agent that:
- Preserves original code byte-for-byte
- Adds metadata headers for traceability
- Maintains SMARTRIQS attributions
- Links to project documentation

## License

MIT Licensed - see [LICENSE](../LICENSE) for details.

## Related Documentation

- [Main README](../README.md) - Project overview and quick start
- [AWS Deployment Guide](../docs/DEPLOY_AWS.md) - Backend infrastructure setup
- [Qualtrics Setup Guide](../docs/SETUP_QUALTRICS.md) - Frontend configuration
- [Architecture Overview](../docs/ARCHITECTURE.md) - System design and data flow
- [Testing Guide](../docs/TESTING.md) - Comprehensive testing procedures
- [FAQ](../docs/FAQ.md) - Frequently asked questions

## Support

For issues, questions, or contributions:
- **GitHub Issues**: https://github.com/amin-rhmti/qualtrics-aws-chatroom-mapper/issues
- **Documentation**: Check the `docs/` directory
- **Backend Code**: See `lambda/individual_group_matching.py`

## Changelog

### 2025-11-10
- Renamed files to descriptive names (Matching.js, Welcome.js, Chat.js, Report.js, Complete.js)
- Updated comprehensive documentation
- Added detailed workflow sequence
- Expanded configuration examples
- Improved error handling documentation