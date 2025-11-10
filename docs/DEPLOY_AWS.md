# Deploy on AWS

## 1) DynamoDB Tables

### ChatEvents
- **Partition key**: `room` (String)
- **Sort key**: `ts` (Number by default)
- RCU/WCU: start with 5/5 (on-demand is fine too)

### MapperWrites
- **Partition key**: `unitID` (String)

> Why `room`/`unitID`? Your current Lambda uses these exact attribute names when reading/writing. Keep them unless you’re also updating the Lambda.

Create via script:
```bash
./scripts/create_dynamodb_tables.sh --chat-table ChatEvents --writes-table MapperWrites
```

## 2) Lambda

- Name: `individual_group_matching`
- Runtime: Python 3.11+ (3.12 OK)
- Handler: `individual_group_matching.lambda_handler`
- **Env Vars**:
  - `DDB_TABLE_WRITES=MapperWrites`
  - `CHAT_TABLE=ChatEvents`
  - `RESOURCE_DIR=/var/task`
  - `CSV_FILE=individual_group_matching.csv`

Zip and deploy:
```bash
./scripts/zip_lambda.sh
./scripts/deploy_lambda_cli.sh --function individual_group_matching --chat-table ChatEvents --writes-table MapperWrites
```

### IAM Policy (attach to Lambda role)
- CloudWatch Logs
- DynamoDB:
  - `dynamodb:DescribeTable` on ChatEvents
  - `dynamodb:PutItem`, `dynamodb:Query`, `dynamodb:UpdateItem`, `dynamodb:GetItem` on both tables

Minimal inline example (adjust ARNs):
```json
{
  "Version":"2012-10-17",
  "Statement":[
    {"Effect":"Allow","Action":["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],"Resource":"*"},
    {"Effect":"Allow","Action":["dynamodb:DescribeTable","dynamodb:Query","dynamodb:PutItem","dynamodb:GetItem","dynamodb:UpdateItem"],"Resource":[
      "arn:aws:dynamodb:us-east-1:123456789012:table/ChatEvents",
      "arn:aws:dynamodb:us-east-1:123456789012:table/MapperWrites"
    ]}
  ]
}
```

## 3) API Gateway (REST, Lambda Proxy)

Create three resources, all **ANY** → Integration: Lambda Proxy to `individual_group_matching`:
- `/individual_group_matching`
- `/chat`
- `/complete`

Stage name: `default`

CORS:
- No special Gateway CORS mapping needed if Lambda returns the headers (it does).
- Ensure **OPTIONS** requests reach the Lambda (it returns 204 with the same headers).

## 4) Sanity checks
```bash
./scripts/sanity_checks.sh   --base https://kr98xfirp7.execute-api.us-east-1.amazonaws.com/default   --id 101   --room 1   --name Alice
```
