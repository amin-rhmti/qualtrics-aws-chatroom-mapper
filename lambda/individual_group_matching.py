# one_lambda_for_both.py  (updated to auto-handle ts as String or Number)

import os, csv, json, time
import boto3
from boto3.dynamodb.conditions import Key
from datetime import datetime, timezone
try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None

# ---------- Env ----------
DDB_TABLE_WRITES = os.environ.get("DDB_TABLE_WRITES")
RESOURCE_DIR     = os.environ.get("RESOURCE_DIR", "/var/task")
CSV_FILE         = "individual_group_matching.csv"
CHAT_TABLE_NAME  = os.environ.get("CHAT_TABLE")              # ChatEvents

CONFIRM_COL      = "lookup_confirmed"
EXTRA_READ_COLS  = ["extra_read_1", "extra_read_2", "extra_read_3"]
EXTRA_WRITE_COLS = ["extra_write_1", "extra_write_2", "extra_write_3"]

ddb          = boto3.resource("dynamodb")
client       = ddb.meta.client
writes_table = ddb.Table(DDB_TABLE_WRITES) if DDB_TABLE_WRITES else None
chat_table   = ddb.Table(CHAT_TABLE_NAME) if CHAT_TABLE_NAME else None

# Detect how 'ts' is defined on the table ("S" or "N")
TS_IS_STRING = False
try:
    if CHAT_TABLE_NAME:
        dt = client.describe_table(TableName=CHAT_TABLE_NAME)
        defs = {a["AttributeName"]: a["AttributeType"] for a in dt["Table"]["AttributeDefinitions"]}
        TS_IS_STRING = (defs.get("ts") == "S")
except Exception:
    # if we can't describe, default to numeric
    TS_IS_STRING = False

CORS = {
    "Access-Control-Allow-Origin": "https://illinois.qualtrics.com",  # use "*" while testing
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Api-Key",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json",
}

def _resp(status, body_obj):
    return {"statusCode": status, "headers": CORS,
            "body": json.dumps(body_obj, ensure_ascii=False),
            "isBase64Encoded": False}

def _qs(event):   return event.get("queryStringParameters") or {}
def _path(event): return (event.get("resource") or event.get("path") or "").lower()
def _method(e):   return (e.get("httpMethod") or "").upper()
def _now_ms():    return int(time.time() * 1000)

def _load_csv():
    path = os.path.join(RESOURCE_DIR, CSV_FILE)
    if not os.path.exists(path):
        raise FileNotFoundError(f"CSV not found at {path}")
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    header = rows[0].keys() if rows else []
    return rows, list(header)

def _unit_id(event):
    qs = _qs(event)
    return qs.get("experimentalUnitID") or event.get("experimentalUnitID")

def _get_writes(unit_id: str) -> dict:
    if not writes_table: return {}
    resp = writes_table.get_item(Key={"unitID": str(unit_id)}).get("Item") or {}
    for k in [CONFIRM_COL, *EXTRA_WRITE_COLS]:
        if k in resp and resp[k] is None: resp[k] = ""
    return resp

def _upsert_writes(unit_id: str, updates: dict) -> bool:
    if not (writes_table and updates): return False
    expr_names, expr_vals, sets = {}, {}, []
    for k, v in updates.items():
        nk, vk = f"#_{k}", f":{k}"
        expr_names[nk] = k
        expr_vals[vk] = str(v)
        sets.append(f"{nk} = {vk}")
    writes_table.update_item(
        Key={"unitID": str(unit_id)},
        UpdateExpression="SET " + ", ".join(sets),
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_vals,
    )
    return True

def _html_escape(s: str) -> str:
    return (s or "").replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")

def _fmt_time(ms: int, chat_time_format: str, tz_name: str) -> str:
    if chat_time_format == "none":
        return ""
    try:
        tz = ZoneInfo(tz_name) if (ZoneInfo and tz_name) else timezone.utc
    except Exception:
        tz = timezone.utc
    dt = datetime.fromtimestamp(ms/1000, tz=timezone.utc).astimezone(tz)
    f = chat_time_format
    if f in ("hm24","24hm","24"):   return dt.strftime("%H:%M")
    if f in ("hms24","24hms"):      return dt.strftime("%H:%M:%S")
    if f in ("hm12","12hm"):        return dt.strftime("%I:%M %p")
    if f in ("hms12","12hms"):      return dt.strftime("%I:%M:%S %p")
    return dt.strftime("%H:%M")

# ---------- /individual_group_matching ----------
def handle_matching(event):
    unit_id = _unit_id(event)
    if not unit_id:
        return _resp(400, {"error": "Query parameter 'experimentalUnitID' is required."})

    rows, _ = _load_csv()
    row = next((r for r in rows if str(r.get("experimentalUnitID")) == str(unit_id)), None)
    if row is None:
        return _resp(404, {"error": f"No data found for experimentalUnitID: {unit_id}"})
    if "groupID" not in row or "participantRole" not in row:
        return _resp(500, {"error": "CSV must contain 'groupID' and 'participantRole' columns."})

    result = {
        "groupID": (row.get("groupID") or "").strip(),
        "participantRole": (row.get("participantRole") or "").strip(),
    }
    
    if "experimentalUnitID_confirmation" in row:
        result["experimentalUnitID_confirmation"] = ((row.get("experimentalUnitID_confirmation") or "").strip())

    for col in EXTRA_READ_COLS:
        if col in row:
            result[col] = row.get(col, "")

    qs = _qs(event)
    incoming = {col: qs[col] for col in EXTRA_WRITE_COLS if qs.get(col) is not None}
    incoming[CONFIRM_COL] = "1"

    persisted = False
    if writes_table:
        _upsert_writes(unit_id, incoming)
        persisted = True
        stored = _get_writes(unit_id)
        for k in [CONFIRM_COL, *EXTRA_WRITE_COLS]:
            if k in stored: result[k] = stored[k]
    else:
        result.update(incoming)

    result["lookup_confirmed"] = result.get(CONFIRM_COL, "1")
    result["_persisted"] = bool(persisted)
    return _resp(200, result)

# ---------- /chat ----------
def chat_send(qs):
    if not chat_table:
        return _resp(500, {"error": "CHAT_TABLE not configured"})
    room = (qs.get("groupID") or "").strip()
    role = (qs.get("participantRole") or "").strip()
    name = (qs.get("name") or role or "Anon").strip()
    text = (qs.get("addText") or "").strip()
    if not room: return _resp(400, {"error": "groupID required"})
    if not text: return _resp(400, {"error": "Empty message"})

    ts = _now_ms()
    ts_value = str(ts) if TS_IS_STRING else ts  # <-- FIX: match table schema

    chat_table.put_item(Item={
        "room": room, "ts": ts_value,
        "sender": name, "role": role, "text": text
    })
    return _resp(200, {"ok": True, "ts": ts})

def chat_poll_or_export(qs):
    if not chat_table:
        return _resp(500, {"error": "CHAT_TABLE not configured"})
    room     = (qs.get("groupID") or "").strip()
    tfmt     = (qs.get("chatTimeFormat") or "none").lower()
    tzname   = qs.get("timeZone") or "UTC"
    do_export = (qs.get("export") == "1")
    export_fmt = (qs.get("format") or "").lower()
    if not room: return _resp(400, {"error": "groupID required"})

    # Full log ascending
    resp = chat_table.query(
        KeyConditionExpression=Key("room").eq(room),
        ScanIndexForward=True, Limit=1000
    )
    items = resp.get("Items", [])
    count = len(items)

    if do_export and export_fmt == "json":
        rows = []
        for it in items:
            # ts may be "S" or "N" — normalize to int for ISO
            try:
                ts_int = int(it["ts"])
            except Exception:
                ts_int = _now_ms()
            dt = datetime.fromtimestamp(ts_int/1000, tz=timezone.utc).isoformat().replace("+00:00","Z")
            rows.append({
                "ts": dt,
                "name": it.get("sender",""),
                "role": it.get("role",""),
                "text": it.get("text","")
            })
        return _resp(200, {
            "chatLogJSON": json.dumps(rows, ensure_ascii=False),
            "count": count
        })

    # Visible HTML
    lines = []
    for it in items:
        try:
            ts_int = int(it["ts"])
        except Exception:
            ts_int = _now_ms()
        tstr = _fmt_time(ts_int, tfmt, tzname)
        who  = _html_escape(it.get("sender",""))
        msg  = _html_escape(it.get("text","")).replace("\n", "<br>")
        line = f"{who}" + (f" ({tstr})" if tstr else "") + f": {msg}"
        lines.append(line)
    html = "<br>".join(lines)
    return _resp(200, {"chat": html, "count": count})

def handle_chat(event):
    qs = _qs(event)
    mode = int(qs.get("mode", "0") or 0)  # 0=poll, 2=send
    if mode == 2 or _method(event) == "POST":
        return chat_send(qs)
    return chat_poll_or_export(qs)

# ---------- /complete ----------
def handle_complete(event):
    return _resp(200, {"ok": True})

# ---------- Router ----------
def lambda_handler(event, context):
    if _method(event) == "OPTIONS":
        return {"statusCode": 204, "headers": CORS, "body": ""}

    try:
        p = _path(event)
        if p.endswith("/chat"):
            return handle_chat(event)
        if p.endswith("/complete"):
            return handle_complete(event)
        if p.endswith("/individual_group_matching"):
            return handle_matching(event)
        return _resp(404, {"error": "Not found"})
    except FileNotFoundError:
        return _resp(500, {"error": "Mapping CSV not found in Lambda package."})
    except Exception as e:
        return _resp(500, {"error": f"Unexpected server error: {str(e)}"})
