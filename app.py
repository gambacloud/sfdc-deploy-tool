import os
import httpx
import asyncio
import xml.etree.ElementTree as ET
from fastapi import FastAPI, Request, HTTPException, Header, Query
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import asyncio
import urllib.parse
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import asyncio
import urllib.parse
from typing import List, Optional
import subprocess
import json
import sys
import os
import httpx

if getattr(sys, 'frozen', False):
    # Running in a PyInstaller bundle
    base_dir = sys._MEIPASS
else:
    # Running in normal Python environment
    base_dir = os.path.dirname(os.path.abspath(__file__))

static_dir = os.path.join(base_dir, "static")

app = FastAPI()

# Mount frontend files
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def index():
    return FileResponse(os.path.join(static_dir, "index.html"))

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

@app.post("/api/proxy/retrieve")
async def retrieve_metadata(req: RetrieveRequest):
    """
    Accepts SFDC credentials/session IDs. Calls the Salesforce Metadata API retrieve(). 
    Streams the resulting base64 ZIP file directly back to the frontend without storing it.
    """
    instance_url = req.instanceUrl if req.instanceUrl.startswith("http") else f"https://{req.instanceUrl}"
    url = f"{instance_url}/services/Soap/m/{req.apiVersion}"
    print(f"[RETRIEVE] Initiating metadata retrieve from {instance_url}...")
    
    import re
    # Safely strip any leading XML declaration and rename Package element to met:unpackaged
    clean_xml = re.sub(r'<\?xml.*?\?>', '', req.unpackagedXml).strip()
    clean_xml = clean_xml.replace('<Package', '<met:unpackaged').replace('</Package>', '</met:unpackaged>')

    # 1. Initiate Retrieve
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

    async with httpx.AsyncClient() as client:
        init_resp = await client.post(url, content=retrieve_soap, headers=get_soap_headers())
        if init_resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Failed to initiate retrieve: {init_resp.text}")
        
        # Parse job ID
        root = ET.fromstring(init_resp.text)
        # Find asyncId. Note namespaces.
        namespaces = {'soapenv': 'http://schemas.xmlsoap.org/soap/envelope/', 'met': 'http://soap.sforce.com/2006/04/metadata'}
        body = root.find('soapenv:Body', namespaces)
        retrieve_response = body.find('met:retrieveResponse', namespaces)
        result = retrieve_response.find('met:result', namespaces)
        job_id = result.find('met:id', namespaces).text
        print(f"[RETRIEVE] Job queued successfully. Job ID: {job_id}. Polling for completion...")

    # 2. Poll for status and stream result back
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

    async def poll_and_stream():
        client = httpx.AsyncClient()
        while True:
            # We must use stream() right from the start. Once a successful response is pulled,
            # Salesforce deletes the result locator on their end, so we can't fetch it a second time.
            async with client.stream("POST", url, content=check_rx_soap, headers=get_soap_headers()) as resp:
                # We need to buffer the response to check the status because the XML is usually small,
                # but if it succeeds, it contains a massive base64 zip.
                # Since we don't want to load a massive zip into memory entirely if we don't have to,
                # let's read the first chunk to peek at the status.
                
                # However, httpx doesn't let us easily 'peek' and then continue yielding.
                # Since the zip is base64 encoded text inside the SOAP XML, accumulating the text in memory
                # in Python is perfectly fine! The limits are high enough.
                full_response = ""
                async for chunk in resp.aiter_text():
                    full_response += chunk
                
                if "status>InProgress" in full_response or "status>Pending" in full_response:
                    print(f"[RETRIEVE] Job {job_id} is still in progress...")
                    await asyncio.sleep(3)
                    continue
                
                # If done (or failed), yield the entire buffered response back to the client cleanly.
                print(f"[RETRIEVE] Job {job_id} finished polling. Streaming results to browser.")
                yield full_response.encode('utf-8')
                break

    return StreamingResponse(poll_and_stream(), media_type="text/xml")


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

    # We do not use stream() here because we just want to return the jobId parsed from the response
    async with httpx.AsyncClient() as client:
        print(f"[DEPLOY] Initiating deployment to {instance_url} (CheckOnly: {req.checkOnly}, TestLevel: {req.testLevel})...")
        resp = await client.post(url, content=deploy_soap, headers=get_soap_headers())
        if resp.status_code != 200:
            print(f"[DEPLOY] Failed! {resp.text}")
            raise HTTPException(status_code=400, detail=f"Deploy failed: {resp.text}")
            
        root = ET.fromstring(resp.text)
        namespaces = {'soapenv': 'http://schemas.xmlsoap.org/soap/envelope/', 'met': 'http://soap.sforce.com/2006/04/metadata'}
        body = root.find('soapenv:Body', namespaces)
        deploy_response = body.find('met:deployResponse', namespaces)
        result = deploy_response.find('met:result', namespaces)
        job_id = result.find('met:id', namespaces).text
        
        print(f"[DEPLOY] Job queued successfully. Job ID: {job_id}.")
        return {"jobId": job_id}


@app.get("/api/proxy/status/{job_id}")
async def check_deploy_status(job_id: str, instanceUrl: str, sessionId: str, apiVersion: str = "58.0"):
    """Checks the status of an asynchronous metadata API job"""
    status_soap = ... # ...
    # ... Wait, actually let's just leave the chunk above untouched, it's safer to add this code higher up.
    pass
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

    # Stream the raw SOAP XML response back directly to bypass memory parsing limits!
    # The Frontend Vanilla JS parse it.
    client = httpx.AsyncClient()
    async def stream_response():
        async with client.stream("POST", url, content=status_soap, headers=get_soap_headers()) as r:
            async for chunk in r.aiter_raw():
                yield chunk
    return StreamingResponse(stream_response(), media_type="text/xml")


# --- REST API Proxy (Tooling API) ---

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
    
    async with httpx.AsyncClient() as client:
        res = await client.get(url, params={"q": q}, headers=headers)
        
        if res.status_code != 200:
            raise HTTPException(status_code=res.status_code, detail=res.text)
            
        return res.json()


# --- SFDX CLI Integration (Org Manager) ---

async def run_cli_command(command: str) -> tuple[int, str, str]:
    """Runs a shell command asynchronously in a thread and returns exit code, stdout, stderr"""
    loop = asyncio.get_event_loop()
    
    # Ensure standard Salesforce CLI install paths are in the environment PATH
    import os
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
        # Fallback to sfdx
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

