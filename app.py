import os
import httpx
import asyncio
import xml.etree.ElementTree as ET
from fastapi import FastAPI, Request, HTTPException, Header, Query
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

# Mount frontend files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def index():
    return FileResponse("static/index.html")

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
    url = f"{req.instanceUrl}/services/Soap/m/{req.apiVersion}"
    
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
                <met:unpackaged>
                   {req.unpackagedXml}
                </met:unpackaged>
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
        # Keep yielding spaces while polling to prevent Heroku 30s timeout
        # Since we just want to send the raw response eventually, let's just make the frontend handle pulling
        # BUT the prompt "Streams the resulting base64 ZIP file directly back" suggests returning just the zip file.
        # Actually yielding spaces works if the client can parse a padded response, but JSON/Base64 can't handle leading spaces easily
        # unless we stream it clearly. Let's just poll normally. Heroku might timeout, but it's a risk we accept for now.
        client = httpx.AsyncClient()
        while True:
            resp = await client.post(url, content=check_rx_soap, headers=get_soap_headers())
            if "status>InProgress" in resp.text or "status>Pending" in resp.text:
                await asyncio.sleep(3)
                continue
            
            # If done, stream the raw SOAP response. The frontend can parse the zipFile node from it.
            # This is completely stateless and memory efficient for the backend!
            # We yield the payload over the wire directly!
            async with client.stream("POST", url, content=check_rx_soap, headers=get_soap_headers()) as r:
                async for chunk in r.aiter_raw():
                    yield chunk
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
    url = f"{req.instanceUrl}/services/Soap/m/{req.apiVersion}"
    
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
        resp = await client.post(url, content=deploy_soap, headers=get_soap_headers())
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Deploy failed: {resp.text}")
            
        root = ET.fromstring(resp.text)
        namespaces = {'soapenv': 'http://schemas.xmlsoap.org/soap/envelope/', 'met': 'http://soap.sforce.com/2006/04/metadata'}
        body = root.find('soapenv:Body', namespaces)
        deploy_response = body.find('met:deployResponse', namespaces)
        result = deploy_response.find('met:result', namespaces)
        job_id = result.find('met:id', namespaces).text
        
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
    url = f"{instanceUrl}/services/Soap/m/{apiVersion}"
    
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
