// Use Tailwind's dark mode class matching diff2html's theme system
const isDark = document.documentElement.classList.contains('dark');

// DOM Elements
const srcInstance = document.getElementById('srcInstance');
const srcSession = document.getElementById('srcSession');
const tgtInstance = document.getElementById('tgtInstance');
const tgtSession = document.getElementById('tgtSession');
const packageXml = document.getElementById('packageXml');

const btnRetrieve = document.getElementById('btnRetrieve');
const btnDemo = document.getElementById('btnDemo');
const btnReset = document.getElementById('btnReset');

const retrieveStatus = document.getElementById('retrieveStatus');
const retrieveProgress = document.getElementById('retrieveProgress');
const retrieveMsg = document.getElementById('retrieveMsg');

const diffSection = document.getElementById('diffSection');
const emptyState = document.getElementById('emptyState');
const diffList = document.getElementById('diffList');
const diffCountBadge = document.getElementById('diffCountBadge');
const selectAll = document.getElementById('selectAll');

const deployActionBar = document.getElementById('deployActionBar');
const btnDeploy = document.getElementById('btnDeploy');
const deployStatus = document.getElementById('deployStatus');
const deployProgress = document.getElementById('deployProgress');
const deployMsg = document.getElementById('deployMsg');
const testClassesInput = document.getElementById('testClasses');
const testLevelInput = document.getElementById('testLevel');

const modal = document.getElementById('diffModal');
const closeModalBtn = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const diffViewer = document.getElementById('diffViewer');

// State
let srcZip = null;
let tgtZip = null;
let changedFiles = [];

// Presets Config
const presets = {
    code: `<types>
    <members>*</members>
    <name>ApexClass</name>
</types>
<types>
    <members>*</members>
    <name>ApexPage</name>
</types>
<types>
    <members>*</members>
    <name>ApexComponent</name>
</types>
<types>
    <members>*</members>
    <name>ApexTrigger</name>
</types>
<types>
    <members>*</members>
    <name>AuraDefinitionBundle</name>
</types>
<types>
    <members>*</members>
    <name>LightningComponentBundle</name>
</types>
<version>58.0</version>`,
    nocode: `<types>
    <members>*</members>
    <name>Flow</name>
</types>
<types>
    <members>*</members>
    <name>ValidationRule</name>
</types>
<version>58.0</version>`,
    config: `<types>
    <members>*</members>
    <name>CustomLabels</name>
</types>
<types>
    <members>*</members>
    <name>CustomMetadata</name>
</types>
<types>
    <members>*</members>
    <name>CustomField</name>
</types>
<version>58.0</version>`
};

const presetButtons = document.querySelectorAll('.preset-btn');
console.log(`[Salesforce Deployer] Found ${presetButtons.length} preset buttons on the page.`);

presetButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const type = e.currentTarget.dataset.preset;
        console.log(`[Salesforce Deployer] Preset button clicked: ${type}`);

        if (presets[type]) {
            const packageXmlElem = document.getElementById('packageXml');
            if (packageXmlElem) {
                packageXmlElem.value = presets[type];
                // Also trigger an input event in case anything relies on it
                packageXmlElem.dispatchEvent(new Event('input'));
                console.log(`[Salesforce Deployer] Successfully updated package.xml for preset: ${type}`);
            } else {
                console.error("[Salesforce Deployer] Error: Could not find 'packageXml' textarea element.");
            }
        } else {
            console.warn(`[Salesforce Deployer] Warning: No preset found for type: ${type}`);
        }
    });
});

// Utils
function extractZipFromSoap(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const resultNode = xmlDoc.getElementsByTagName("result")[0] || xmlDoc.getElementsByTagName("met:result")[0];
    if (!resultNode) throw new Error("Result node not found in SOAP response.");

    const successNode = xmlDoc.getElementsByTagName("success")[0] || xmlDoc.getElementsByTagName("met:success")[0];
    if (successNode && successNode.textContent === 'false') {
        const msgNode = xmlDoc.getElementsByTagName("errorMessage")[0] || xmlDoc.getElementsByTagName("met:errorMessage")[0];
        throw new Error(msgNode ? msgNode.textContent : "Unknown API Error");
    }

    const zipNode = xmlDoc.getElementsByTagName("zipFile")[0] || xmlDoc.getElementsByTagName("met:zipFile")[0];
    if (zipNode) return zipNode.textContent;
    throw new Error("Could not find ZIP file string in response.");
}

async function fetchMetadata(instanceUrl, sessionId, xmlPayload) {
    const res = await fetch('/api/proxy/retrieve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            instanceUrl,
            sessionId,
            unpackagedXml: xmlPayload
        })
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Proxy Error: ${err}`);
    }
    const soapStr = await res.text();
    const base64 = extractZipFromSoap(soapStr);
    const jszip = new JSZip();
    return await jszip.loadAsync(base64, { base64: true });
}

function setProgress(bar, msgElem, percent, msg, isError = false) {
    if (percent !== null) bar.style.width = `${percent}%`;
    if (msg) msgElem.innerText = msg;

    if (isError) {
        bar.classList.remove('bg-blue-600', 'bg-emerald-600');
        bar.classList.add('bg-red-500');
        msgElem.classList.add('text-red-600', 'dark:text-red-400');
    } else {
        bar.classList.remove('bg-red-500');
        msgElem.classList.remove('text-red-600', 'dark:text-red-400');
    }
}

// Retrieve Flow
btnRetrieve.addEventListener('click', async () => {
    if (!srcSession.value || !tgtSession.value) {
        alert("Please provide both Source and Target session IDs.");
        return;
    }

    retrieveStatus.classList.remove('hidden');
    emptyState.classList.add('hidden');
    diffSection.classList.add('hidden');
    deployActionBar.style.display = 'none';
    btnRetrieve.disabled = true;
    btnRetrieve.innerHTML = `<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing...`;

    try {
        setProgress(retrieveProgress, retrieveMsg, 10, 'Initiating Retrieve for Source and Target orgs...', false);

        const xml = packageXml.value;

        const [src, tgt] = await Promise.all([
            fetchMetadata(srcInstance.value, srcSession.value, xml).catch(e => { throw new Error(`Source Org Error: ${e.message}`); }),
            fetchMetadata(tgtInstance.value, tgtSession.value, xml).catch(e => { throw new Error(`Target Org Error: ${e.message}`); })
        ]);

        srcZip = src;
        tgtZip = tgt;

        setProgress(retrieveProgress, retrieveMsg, 60, 'Metadata retrieved. Comparing files...', false);
        await compareZips(src, tgt);

        setProgress(retrieveProgress, retrieveMsg, 100, `Comparison complete. Found ${changedFiles.length} differences.`, false);
        diffCountBadge.textContent = `${changedFiles.length} files`;
        renderDiffTable();
        diffSection.classList.remove('hidden');
        deployActionBar.style.display = 'flex';

    } catch (err) {
        setProgress(retrieveProgress, retrieveMsg, 100, err.message, true);
    } finally {
        btnRetrieve.disabled = false;
        btnRetrieve.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"></path></svg> Fetch & Compare`;
    }
});

// Demo Data Flow
btnDemo.addEventListener('click', () => {
    changedFiles = [
        {
            name: "unpackaged/classes/AccountTriggerHandler.cls",
            status: "Modified",
            srcContent: "public class AccountTriggerHandler {\n    public static void afterInsert(List<Account> newAccounts) {\n        // Handled insertion logic\n        System.debug('Account created');\n    }\n}",
            tgtContent: "public class AccountTriggerHandler {\n    public static void afterInsert(List<Account> newAccounts) {\n        // Old logic\n    }\n}"
        },
        {
            name: "unpackaged/objects/Opportunity.object",
            status: "Modified",
            srcContent: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<CustomObject xmlns=\"http://soap.sforce.com/2006/04/metadata\">\n    <fields>\n        <fullName>Discount__c</fullName>\n        <type>Percent</type>\n    </fields>\n</CustomObject>",
            tgtContent: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<CustomObject xmlns=\"http://soap.sforce.com/2006/04/metadata\">\n    <!-- Missing Discount field -->\n</CustomObject>"
        },
        {
            name: "unpackaged/lwc/customDatatable/customDatatable.js",
            status: "New",
            srcContent: "import { LightningElement } from 'lwc';\n\nexport default class CustomDatatable extends LightningElement {\n    data = [];\n    columns = [{ label: 'Name', fieldName: 'name' }];\n}",
            tgtContent: ""
        }
    ];

    emptyState.classList.add('hidden');

    diffCountBadge.textContent = `${changedFiles.length} files`;
    renderDiffTable();
    diffSection.classList.remove('hidden');
    deployActionBar.style.display = 'flex';

    btnDemo.classList.add('hidden');
    btnReset.classList.remove('hidden');
});

// Reset Flow
btnReset.addEventListener('click', () => {
    changedFiles = [];
    srcZip = null;
    tgtZip = null;

    diffSection.classList.add('hidden');
    deployActionBar.style.display = 'none';
    retrieveStatus.classList.add('hidden');
    deployStatus.classList.add('hidden');
    emptyState.classList.remove('hidden');

    btnReset.classList.add('hidden');
    btnDemo.classList.remove('hidden');
});

async function compareZips(src, tgt) {
    changedFiles = [];
    const srcFiles = Object.keys(src.files).filter(f => !src.files[f].dir && f !== 'unpackaged/package.xml');

    for (const fileName of srcFiles) {
        const srcContent = await src.file(fileName).async("string");

        if (!tgt.file(fileName)) {
            changedFiles.push({ name: fileName, status: 'New', srcContent, tgtContent: '' });
        } else {
            const tgtContent = await tgt.file(fileName).async("string");
            if (srcContent !== tgtContent) {
                changedFiles.push({ name: fileName, status: 'Modified', srcContent, tgtContent });
            }
        }
    }
}

function renderDiffTable() {
    diffList.innerHTML = '';
    selectAll.checked = false;

    if (changedFiles.length === 0) {
        diffList.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-sm text-gray-500">No differences found. Orgs are perfectly synced for this manifest.</td></tr>';
        deployActionBar.style.display = 'none';
        return;
    }

    const folderToType = {
        'classes': 'ApexClass', 'pages': 'ApexPage', 'components': 'ApexComponent',
        'triggers': 'ApexTrigger', 'aura': 'AuraDefinitionBundle', 'lwc': 'LightningComponentBundle',
        'objects': 'CustomObject', 'layouts': 'Layout', 'permissionsets': 'PermissionSet',
        'profiles': 'Profile', 'customMetadata': 'CustomMetadata', 'labels': 'CustomLabels'
    };

    changedFiles.forEach((f, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group';
        tr.onclick = (e) => {
            // Prevent opening modal if clicking the checkbox
            if (e.target.tagName.toLowerCase() === 'input') return;
            showDiff(idx);
        };

        const tdCheck = document.createElement('td');
        tdCheck.className = 'px-6 py-4 whitespace-nowrap';
        tdCheck.innerHTML = `<input type="checkbox" class="file-checkbox w-4 h-4 text-salesforce border-gray-300 rounded focus:ring-salesforce cursor-pointer" data-idx="${idx}">`;

        const tdStatus = document.createElement('td');
        tdStatus.className = 'px-6 py-4 whitespace-nowrap';
        if (f.status === 'New') {
            tdStatus.innerHTML = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800/50 uppercase tracking-wide">New</span>`;
        } else {
            tdStatus.innerHTML = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 uppercase tracking-wide">Modified</span>`;
        }

        const rawName = f.name.replace('unpackaged/', '');
        const parts = rawName.split('/');
        let typeName = 'Unknown';
        let compName = rawName;

        if (parts.length >= 2) {
            typeName = folderToType[parts[0]] || parts[0];
            compName = parts.slice(1).join('/');
        }

        const tdType = document.createElement('td');
        tdType.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono';
        tdType.textContent = typeName;

        const tdName = document.createElement('td');
        tdName.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-salesforce transition-colors';
        tdName.innerHTML = `<div class="flex items-center gap-2">${compName} <svg class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></div>`;

        tr.appendChild(tdCheck);
        tr.appendChild(tdStatus);
        tr.appendChild(tdType);
        tr.appendChild(tdName);

        diffList.appendChild(tr);
    });
}

selectAll.addEventListener('change', (e) => {
    document.querySelectorAll('.file-checkbox').forEach(cb => cb.checked = e.target.checked);
});

function showDiff(idx) {
    const f = changedFiles[idx];
    modalTitle.textContent = f.name.replace('unpackaged/', '');

    const patch = Diff.createTwoFilesPatch(
        f.name + " (Target)", f.name + " (Source)",
        f.tgtContent, f.srcContent
    );

    // Check if body has dark class
    const currentIsDark = document.documentElement.classList.contains('dark');

    const diffHtml = Diff2Html.html(patch, {
        drawFileList: false,
        matching: 'lines',
        outputFormat: 'side-by-side',
        theme: currentIsDark ? 'dark' : 'light' // Use auto theme feature of diff2html
    });

    diffViewer.innerHTML = diffHtml;
    modal.classList.remove('hidden');
    // small timeout to allow modal to display before triggering transition
    setTimeout(() => {
        modal.querySelector('.transform').classList.add('scale-100', 'opacity-100');
        modal.querySelector('.transform').classList.remove('scale-95', 'opacity-0');
    }, 10);
}

closeModalBtn.onclick = () => {
    modal.classList.add('hidden');
};

// Deploy Flow
btnDeploy.addEventListener('click', async () => {
    const selectedIndexes = Array.from(document.querySelectorAll('.file-checkbox:checked')).map(cb => parseInt(cb.dataset.idx));
    if (selectedIndexes.length === 0) {
        alert("Please select at least one component to deploy.");
        return;
    }

    deployStatus.classList.remove('hidden');
    btnDeploy.disabled = true;

    try {
        setProgress(deployProgress, deployMsg, 10, 'Building deployment ZIP...', false);

        const deployZip = new JSZip();
        const typesMap = {};

        const folderToType = {
            'classes': 'ApexClass',
            'pages': 'ApexPage',
            'components': 'ApexComponent',
            'triggers': 'ApexTrigger',
            'aura': 'AuraDefinitionBundle',
            'lwc': 'LightningComponentBundle',
            'objects': 'CustomObject',
            'layouts': 'Layout',
            'permissionsets': 'PermissionSet',
            'profiles': 'Profile'
        };

        selectedIndexes.forEach(idx => {
            const file = changedFiles[idx];
            deployZip.file(file.name, file.srcContent);

            const parts = file.name.split('/');
            if (parts.length >= 3) {
                const folder = parts[1];
                let filename = parts.slice(2).join('/');
                filename = filename.split('.')[0];
                const typeName = folderToType[folder] || folder;

                if (!typesMap[typeName]) typesMap[typeName] = new Set();
                typesMap[typeName].add(filename);
            }
        });

        let newPackageXml = `<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n`;
        for (const [type, members] of Object.entries(typesMap)) {
            newPackageXml += `  <types>\n`;
            members.forEach(m => newPackageXml += `    <members>${m}</members>\n`);
            newPackageXml += `    <name>${type}</name>\n  </types>\n`;
        }
        newPackageXml += `  <version>58.0</version>\n</Package>`;

        deployZip.file('unpackaged/package.xml', newPackageXml);

        setProgress(deployProgress, deployMsg, 30, 'Uploading ZIP to Target Org...', false);
        const base64Zip = await deployZip.generateAsync({ type: "base64" });

        const testClasses = testClassesInput.value.split(',').map(s => s.trim()).filter(s => s);

        const res = await fetch('/api/proxy/deploy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                instanceUrl: tgtInstance.value,
                sessionId: tgtSession.value,
                zipBase64: base64Zip,
                testLevel: testLevelInput.value,
                testClasses: testClasses
            })
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Deploy Proxy Error: ${err}`);
        }

        const data = await res.json();
        const jobId = data.jobId;

        setProgress(deployProgress, deployMsg, 50, `Deploy Job Queued (${jobId}). Polling status...`, false);

        await pollDeployStatus(jobId, tgtInstance.value, tgtSession.value);

    } catch (err) {
        setProgress(deployProgress, deployMsg, 100, err.message, true);
    } finally {
        btnDeploy.disabled = false;
    }
});

async function pollDeployStatus(jobId, instanceUrl, sessionId) {
    let done = false;
    while (!done) {
        await new Promise(r => setTimeout(r, 3000));

        const qs = new URLSearchParams({ instanceUrl, sessionId, apiVersion: '58.0' }).toString();
        const res = await fetch(`/api/proxy/status/${jobId}?${qs}`);
        if (!res.ok) throw new Error("Failed to check deploy status");

        const soapStr = await res.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(soapStr, "text/xml");

        const statusNode = xmlDoc.getElementsByTagName("status")[0] || xmlDoc.getElementsByTagName("met:status")[0];
        if (!statusNode) continue;

        const status = statusNode.textContent;
        setProgress(deployProgress, deployMsg, null, `Deploy Status: ${status}...`, false);

        if (status === 'Succeeded' || status === 'Failed' || status === 'Canceled') {
            done = true;
            if (status === 'Succeeded') {
                setProgress(deployProgress, deployMsg, 100, 'Deployment Succeeded! 🎉', false);
            } else {
                const errNode = xmlDoc.getElementsByTagName("problem")[0] || xmlDoc.getElementsByTagName("met:problem")[0];
                const msg = errNode ? errNode.textContent : "Deployment Failed. Check Salesforce for details.";
                setProgress(deployProgress, deployMsg, 100, msg, true);
            }
        }
    }
}
