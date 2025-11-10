# FAQ

**Q: CORS error in Qualtrics.**  
A: Confirm that Lambda responses include:
```
Access-Control-Allow-Origin: https://illinois.qualtrics.com
Access-Control-Allow-Headers: Content-Type,Authorization,X-Api-Key
Access-Control-Allow-Methods: GET,POST,OPTIONS
```
Use `./scripts/sanity_checks.sh` to verify.

**Q: “CSV not found at /var/task/individual_group_matching.csv.”**  
A: Ensure the CSV is at the **zip root**. Use `zip_lambda.sh`.

**Q: “CSV must contain 'groupID' and 'participantRole' columns.”**  
A: Add them to the CSV headers and redeploy.

**Q: Chat table sort key type mismatch.**  
A: The Lambda auto-detects `ts` = String or Number on first call and writes accordingly. If you change the table definition, no code change needed.

**Q: Qualtrics ‘Save & Continue’?**  
A: Save & Continue prevents restart on refresh. Qualtrics handles this in survey options; not related to the Lambda.

**Q: Can I store transcripts?**  
A: Yes—extend `/complete` to write transcript to DDB/S3. The scaffold keeps it minimal.
