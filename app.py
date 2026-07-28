import os
import base64
import hashlib
import httpx
import asyncio
import xml.etree.ElementTree as ET
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, Header, Query
from fastapi.responses import StreamingResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
import urllib.parse
from typing import List, Optional
import subprocess
import json
import sys
from cachetools import TTLCache

if getattr(sys, 'frozen', False):
    base_dir = sys._MEIPASS
else:
    base_dir = os.path.dirname(os.path.abspath(__file__))

static_dir = os.path.join(base_dir, "static")

# ZIP cache: keyed by (instanceUrl, sha256(package_xml)), 2-minute TTL.
# Covers rapid re-compares (e.g. target org almost never changes between iterations).
_retrieve_cache: TTLCache = TTLCache(maxsize=10, ttl=120)

# In-memory TTL cache for listMetadata (per org+types, 5-minute TTL)
_list_metadata_cache: TTLCache = TTLCache(maxsize=200, ttl=300)

_http_client: httpx.AsyncClient = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _http_client
    _http_client = httpx.AsyncClient(timeout=httpx.Timeout(300.0))
    yield
    await _http_client.aclose()

app = FastAPI(lifespan=lifespan)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Mount frontend files
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def index():
    return FileResponse(os.path.join(static_dir, "index.html"))

@app.get("/metadata-kb")
def metadata_kb():
    return FileResponse(os.path.join(static_dir, "metadata-kb.html"))

@app.get("/.well-known/appspecific/com.chrome.devtools.json")
async def chrome_devtools():
    return Response(content="{}", media_type="application/json")

class RetrieveRequest(BaseModel):
    instanceUrl: str
    sessionId: str
    apiVersion: str = "58.0"
    unpackagedXml: str  # XML string for the <unpackaged> node

def get_soap_headers():
    return {
        "Content-Type": "text/xml; charset=UTF-8",
        "SOAPAction": '""'
    }

_SOAP_NS = {
    'soapenv': 'http://schemas.xmlsoap.org/soap/envelope/',
    'met': 'http://soap.sforce.com/2006/04/metadata'
}

@app.post("/api/proxy/retrieve")
async def retrieve_metadata(req: RetrieveRequest):
    """
    Calls the Salesforce Metadata API retrieve(), polls until done, then returns
    the result as a raw binary ZIP (application/zip) instead of base64-in-SOAP XML.
    Results are cached for 2 minutes by (instanceUrl, package_xml hash).
    """
    import re
    instance_url = req.instanceUrl if req.instanceUrl.startswith("http") else f"https://{req.instanceUrl}"

    cache_key = (instance_url, hashlib.sha256(req.unpackagedXml.encode()).hexdigest())
    if cache_key in _retrieve_cache:
        zip_bytes = _retrieve_cache[cache_key]
        print(f"[RETRIEVE] Cache hit for {instance_url} ({len(zip_bytes):,} bytes)")
        return Response(content=zip_bytes, media_type="application/zip")

    url = f"{instance_url}/services/Soap/m/{req.apiVersion}"
    print(f"[RETRIEVE] Initiating metadata retrieve from {instance_url}...")

    clean_xml = re.sub(r'<\?xml.*?\?>', '', req.unpackagedXml).strip()
    clean_xml = clean_xml.replace('<Package', '<met:unpackaged').replace('</Package>', '</met:unpackaged>')

    retrieve_soap = f"""<?xml version="1.0" encoding="utf-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
       <soapenv:Header>
          <met:SessionHeader>
             <met:sessionId>{req.sessionId}</met:sessionId>
          </met:SessionHeader>
       </soapenv:Header>
       <soapenv:Body>
          <met:retrieve>
             <met:retrieveRequest>
                <met:apiVersion>{req.apiVersion}</met:apiVersion>
                {clean_xml}
             </met:retrieveRequest>
          </met:retrieve>
       </soapenv:Body>
    </soapenv:Envelope>"""

    init_resp = await _http_client.post(url, content=retrieve_soap, headers=get_soap_headers())
    if init_resp.status_code != 200:
        raise HTTPException(status_code=400, detail=f"Failed to initiate retrieve: {init_resp.text}")

    root = ET.fromstring(init_resp.text)
    body = root.find('soapenv:Body', _SOAP_NS)
    job_id = body.find('met:retrieveResponse/met:result/met:id', _SOAP_NS).text
    print(f"[RETRIEVE] Job queued successfully. Job ID: {job_id}. Polling for completion...")

    check_rx_soap = f"""<?xml version="1.0" encoding="utf-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
       <soapenv:Header>
          <met:SessionHeader>
             <met:sessionId>{req.sessionId}</met:sessionId>
          </met:SessionHeader>
       </soapenv:Header>
       <soapenv:Body>
          <met:checkRetrieveStatus>
             <met:asyncProcessId>{job_id}</met:asyncProcessId>
             <met:includeZip>true</met:includeZip>
          </met:checkRetrieveStatus>
       </soapenv:Body>
    </soapenv:Envelope>"""

    while True:
        poll_resp = await _http_client.post(url, content=check_rx_soap, headers=get_soap_headers())
        text = poll_resp.text

        if "status>InProgress" in text or "status>Pending" in text:
            print(f"[RETRIEVE] Job {job_id} is still in progress...")
            await asyncio.sleep(1)
            continue

        root = ET.fromstring(text)
        body = root.find('soapenv:Body', _SOAP_NS)

        fault = body.find('soapenv:Fault', _SOAP_NS)
        if fault is not None:
            raise HTTPException(status_code=400, detail=f"Retrieve SOAP fault: {fault.findtext('faultstring', default='Unknown error')}")

        result = body.find('.//met:result', _SOAP_NS)
        if result is None:
            raise HTTPException(status_code=400, detail="No result node in retrieve response")

        if result.findtext('met:success', namespaces=_SOAP_NS) == 'false':
            error_msg = result.findtext('met:errorMessage', namespaces=_SOAP_NS) or 'Retrieve failed'
            raise HTTPException(status_code=400, detail=error_msg)

        zip_b64 = result.findtext('met:zipFile', namespaces=_SOAP_NS)
        if not zip_b64:
            raise HTTPException(status_code=400, detail="No ZIP file in retrieve response")

        zip_bytes = base64.b64decode(zip_b64)
        _retrieve_cache[cache_key] = zip_bytes
        print(f"[RETRIEVE] Job {job_id} complete. Cached and returning {len(zip_bytes):,} binary bytes.")
        return Response(content=zip_bytes, media_type="application/zip")


class DeployRequest(BaseModel):
    instanceUrl: str
    sessionId: str
    apiVersion: str = "58.0"
    zipBase64: str
    testLevel: str = "NoTestRun"
    testClasses: List[str] = []
    checkOnly: bool = True

@app.post("/api/proxy/deploy")
async def deploy_metadata(req: DeployRequest):
    """
    Accepts a base64 encoded ZIP from the frontend and forwards it to the Salesforce Metadata API deploy() endpoint.
    Returns the Job ID.
    """
    instance_url = req.instanceUrl if req.instanceUrl.startswith("http") else f"https://{req.instanceUrl}"
    url = f"{instance_url}/services/Soap/m/{req.apiVersion}"

    tests_xml = ""
    for test in req.testClasses:
        tests_xml += f"<met:runTests>{test}</met:runTests>\n"

    deploy_soap = f"""<?xml version="1.0" encoding="utf-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
       <soapenv:Header>
          <met:SessionHeader>
             <met:sessionId>{req.sessionId}</met:sessionId>
          </met:SessionHeader>
       </soapenv:Header>
       <soapenv:Body>
          <met:deploy>
             <met:zipFile>{req.zipBase64}</met:zipFile>
             <met:DeployOptions>
                <met:allowMissingFiles>false</met:allowMissingFiles>
                <met:autoUpdatePackage>false</met:autoUpdatePackage>
                <met:checkOnly>{str(req.checkOnly).lower()}</met:checkOnly>
                <met:ignoreWarnings>false</met:ignoreWarnings>
                <met:performRetrieve>false</met:performRetrieve>
                <met:purgeOnDelete>false</met:purgeOnDelete>
                <met:rollbackOnError>true</met:rollbackOnError>
                <met:testLevel>{req.testLevel}</met:testLevel>
                {tests_xml}
             </met:DeployOptions>
          </met:deploy>
       </soapenv:Body>
    </soapenv:Envelope>"""

    print(f"[DEPLOY] Initiating deployment to {instance_url} (CheckOnly: {req.checkOnly}, TestLevel: {req.testLevel})...")
    resp = await _http_client.post(url, content=deploy_soap, headers=get_soap_headers())
    if resp.status_code != 200:
        print(f"[DEPLOY] Failed! {resp.text}")
        raise HTTPException(status_code=400, detail=f"Deploy failed: {resp.text}")

    root = ET.fromstring(resp.text)
    body = root.find('soapenv:Body', _SOAP_NS)
    job_id = body.find('met:deployResponse/met:result/met:id', _SOAP_NS).text

    print(f"[DEPLOY] Job queued successfully. Job ID: {job_id}.")
    return {"jobId": job_id}


@app.get("/api/proxy/status/{job_id}")
async def check_deploy_status(
    job_id: str,
    instanceUrl: str = Query(...),
    sessionId: str = Query(...),
    apiVersion: str = Query("58.0")
):
    """
    Proxies the checkDeployStatus call to Salesforce for polling.
    Values should be passed as query parameters.
    """
    instance_url = instanceUrl if instanceUrl.startswith("http") else f"https://{instanceUrl}"
    url = f"{instance_url}/services/Soap/m/{apiVersion}"

    status_soap = f"""<?xml version="1.0" encoding="utf-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
       <soapenv:Header>
          <met:SessionHeader>
             <met:sessionId>{sessionId}</met:sessionId>
          </met:SessionHeader>
       </soapenv:Header>
       <soapenv:Body>
          <met:checkDeployStatus>
             <met:asyncProcessId>{job_id}</met:asyncProcessId>
             <met:includeDetails>true</met:includeDetails>
          </met:checkDeployStatus>
       </soapenv:Body>
    </soapenv:Envelope>"""

    async def stream_response():
        async with _http_client.stream("POST", url, content=status_soap, headers=get_soap_headers()) as r:
            async for chunk in r.aiter_bytes():
                yield chunk

    return StreamingResponse(stream_response(), media_type="text/xml")


class ListMetadataRequest(BaseModel):
    instanceUrl: str
    sessionId: str
    apiVersion: str = "58.0"
    types: List[str] # List of metadata types to query, max 3

@app.post("/api/proxy/listMetadata")
async def list_metadata(req: ListMetadataRequest):
    """
    Accepts a list of metadata types (up to 3) and queries the listMetadata API.
    Returns a list of FileProperties.
    """
    cache_key = (req.instanceUrl, tuple(sorted(req.types)))
    if cache_key in _list_metadata_cache:
        print(f"[LIST_METADATA] Cache hit for {req.types}")
        return _list_metadata_cache[cache_key]

    instance_url = req.instanceUrl if req.instanceUrl.startswith("http") else f"https://{req.instanceUrl}"
    url = f"{instance_url}/services/Soap/m/{req.apiVersion}"

    queries_xml = ""
    for t in req.types[:3]:
        queries_xml += f"<met:queries><met:type>{t}</met:type></met:queries>\n"

    list_soap = f"""<?xml version="1.0" encoding="utf-8"?>
    <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:met="http://soap.sforce.com/2006/04/metadata">
       <soapenv:Header>
          <met:SessionHeader>
             <met:sessionId>{req.sessionId}</met:sessionId>
          </met:SessionHeader>
       </soapenv:Header>
       <soapenv:Body>
          <met:listMetadata>
{queries_xml}             <met:asOfVersion>{req.apiVersion}</met:asOfVersion>
          </met:listMetadata>
       </soapenv:Body>
    </soapenv:Envelope>"""

    resp = await _http_client.post(url, content=list_soap, headers=get_soap_headers())
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail=f"listMetadata failed: {resp.text}")

    root = ET.fromstring(resp.text)
    body = root.find('soapenv:Body', _SOAP_NS)

    fault = body.find('soapenv:Fault', _SOAP_NS)
    if fault is not None:
         faultstring = fault.findtext('faultstring', default="")
         raise HTTPException(status_code=400, detail=f"listMetadata SOAP fault: {faultstring}")

    list_response = body.find('met:listMetadataResponse', _SOAP_NS)

    results = []
    if list_response is not None:
        for res in list_response.findall('met:result', _SOAP_NS):
            results.append({
                "fullName": res.findtext('met:fullName', default="", namespaces=_SOAP_NS),
                "type": res.findtext('met:type', default="", namespaces=_SOAP_NS),
                "lastModifiedByName": res.findtext('met:lastModifiedByName', default="", namespaces=_SOAP_NS),
                "lastModifiedDate": res.findtext('met:lastModifiedDate', default="", namespaces=_SOAP_NS)
            })
    result = {"result": results}
    _list_metadata_cache[cache_key] = result
    return result


# --- REST API Proxy (Standard & Tooling) ---

@app.get("/api/proxy/query")
async def standard_query(instanceUrl: str, sessionId: str, q: str):
    """Executes a SOQL query against the Salesforce Standard REST API, following all pagination pages."""
    if not instanceUrl or not sessionId or not q:
        raise HTTPException(status_code=400, detail="Missing instanceUrl, sessionId, or query 'q'")

    instance_url = instanceUrl.rstrip('/')
    instance_url = instance_url if instance_url.startswith("http") else f"https://{instance_url}"
    url = f"{instance_url}/services/data/v58.0/query"
    headers = {
        "Authorization": f"Bearer {sessionId}",
        "Accept": "application/json"
    }

    all_records = []
    res = await _http_client.get(url, params={"q": q}, headers=headers)
    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail=res.text)
    data = res.json()
    all_records.extend(data.get("records", []))

    while not data.get("done", True) and data.get("nextRecordsUrl"):
        next_url = f"{instance_url}{data['nextRecordsUrl']}"
        res = await _http_client.get(next_url, headers=headers)
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=res.text)
        data = res.json()
        all_records.extend(data.get("records", []))

    data["records"] = all_records
    data["done"] = True
    data["totalSize"] = len(all_records)
    return data


@app.get("/api/proxy/tooling/query")
async def tooling_query(instanceUrl: str, sessionId: str, q: str):
    """Executes a SOQL query against the Salesforce Tooling API"""
    if not instanceUrl or not sessionId or not q:
        raise HTTPException(status_code=400, detail="Missing instanceUrl, sessionId, or query 'q'")

    instance_url = instanceUrl.rstrip('/')
    instance_url = instance_url if instance_url.startswith("http") else f"https://{instance_url}"
    url = f"{instance_url}/services/data/v58.0/tooling/query"
    headers = {
        "Authorization": f"Bearer {sessionId}",
        "Accept": "application/json"
    }

    res = await _http_client.get(url, params={"q": q}, headers=headers)
    if res.status_code != 200:
        raise HTTPException(status_code=res.status_code, detail=res.text)
    return res.json()


# --- SFDX CLI Integration (Org Manager) ---

async def run_cli_command(command: str) -> tuple[int, str, str]:
    """Runs a shell command asynchronously in a thread and returns exit code, stdout, stderr"""
    loop = asyncio.get_event_loop()

    env = os.environ.copy()
    sf_paths = [
        r"C:\Program Files\sf\bin",
        r"C:\Program Files\sfdx\bin"
    ]
    current_path = env.get("PATH", "")
    for p in sf_paths:
        if p not in current_path:
            current_path = p + os.pathsep + current_path
    env["PATH"] = current_path

    def _run():
        return subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            env=env
        )
    process = await loop.run_in_executor(None, _run)
    return process.returncode, process.stdout, process.stderr

@app.get("/api/sfdx/status")
async def check_sfdx_status():
    """Checks if sf or sfdx CLI is installed and returns version."""
    code, stdout, _ = await run_cli_command("sf --version")
    if code == 0:
        return {"installed": True, "cli": "sf", "version": stdout.strip()}

    code, stdout, _ = await run_cli_command("sfdx --version")
    if code == 0:
        return {"installed": True, "cli": "sfdx", "version": stdout.strip()}

    return {"installed": False}

@app.get("/api/sfdx/orgs")
async def list_orgs():
    """Lists authorized orgs using sf org list"""
    code, stdout, stderr = await run_cli_command("sf org list --json")
    if code != 0:
        code, stdout, stderr = await run_cli_command("sfdx force:org:list --json --clean")

    if code != 0:
        raise HTTPException(status_code=500, detail=f"Failed to list orgs. Is the CLI installed? {stderr}")

    try:
        data = json.loads(stdout)
        import pprint
        return {"result": data.get("result", {})}
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Failed to parse CLI output: {stdout}")

class LoginRequest(BaseModel):
    alias: str
    instanceUrl: Optional[str] = None # For sandboxes

@app.post("/api/sfdx/login")
async def login_org(req: LoginRequest):
    """Initiates web login for a new org"""
    cmd = f"sf org login web --alias {req.alias}"
    if req.instanceUrl:
        cmd += f" --instance-url {req.instanceUrl}"

    code, stdout, stderr = await run_cli_command(cmd)

    if code != 0:
         raise HTTPException(status_code=400, detail=f"Login failed: {stderr}")

    return {"success": True, "message": stdout}

class OpenRequest(BaseModel):
    targetOrg: str

@app.post("/api/sfdx/open")
async def open_org(req: OpenRequest):
    """Opens an org in the browser"""
    cmd = f"sf org open --target-org {req.targetOrg}"
    await run_cli_command(cmd)
    return {"success": True}

@app.get("/api/sfdx/token/{target_org}")
async def get_org_token(target_org: str):
    """Fetches a fresh access token for a given org"""
    code, stdout, stderr = await run_cli_command(f"sf org display --target-org {target_org} --json")
    if code != 0:
        code, stdout, stderr = await run_cli_command(f"sfdx force:org:display --targetusername {target_org} --json")

    if code != 0:
         raise HTTPException(status_code=400, detail=f"Failed to fetch token: {stderr}")

    try:
        data = json.loads(stdout)
        result = data.get("result", {})
        return {
            "accessToken": result.get("accessToken"),
            "instanceUrl": result.get("instanceUrl"),
            "username": result.get("username"),
            "id": result.get("id")
        }
    except json.JSONDecodeError:
         raise HTTPException(status_code=500, detail="Failed to parse CLI output")
