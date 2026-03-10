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
const btnValidate = document.getElementById('btnValidate');
const btnDeploy = document.getElementById('btnDeploy');

const retrieveStatus = document.getElementById('retrieveStatus');
const retrieveProgress = document.getElementById('retrieveProgress');
const retrieveMsg = document.getElementById('retrieveMsg');

const diffSection = document.getElementById('diffSection');
const emptyState = document.getElementById('emptyState');
const diffList = document.getElementById('diffList');
const diffCountBadge = document.getElementById('diffCountBadge');
const selectAll = document.getElementById('selectAll');

// Health Check DOM Elements
const tabDeploy = document.getElementById('tabDeploy');
const tabHealth = document.getElementById('tabHealth');
const targetOrgContainer = document.getElementById('targetOrgContainer');
const deployScopeContainer = document.getElementById('deployScopeContainer');
const healthCheckContainer = document.getElementById('healthCheckContainer');
const btnAnalyze = document.getElementById('btnAnalyze');
const healthEmptyState = document.getElementById('healthEmptyState');
const dependenciesSection = document.getElementById('dependenciesSection');
const componentNameInput = document.getElementById('componentNameInput');
const depList = document.getElementById('depList');
const depCountBadge = document.getElementById('depCountBadge');



const deployActionBar = document.getElementById('deployActionBar');
const deployStatus = document.getElementById('deployStatus');
const deployProgress = document.getElementById('deployProgress');
const deployMsg = document.getElementById('deployMsg');
const testClassesInput = document.getElementById('testClasses');
const testLevelInput = document.getElementById('testLevel');

const modal = document.getElementById('diffModal');
const closeModalBtn = document.getElementById('closeModal');
const modalTitle = document.getElementById('modalTitle');
const diffViewer = document.getElementById('diffViewer');

// UI Enhancements elements
const btnSwapOrgs = document.getElementById('btnSwapOrgs');
const selectedCountText = document.getElementById('selectedCountText');
const showSelectedOnly = document.getElementById('showSelectedOnly');
const statusFilter = document.getElementById('statusFilter');

const srcOrgAliasLabel = document.getElementById('srcOrgAliasLabel');
const tgtOrgAliasLabel = document.getElementById('tgtOrgAliasLabel');

// State
let srcZip = null;
let tgtZip = null;
let changedFiles = [];

// Presets Config
const presets = {
    code: ['ApexClass', 'ApexComponent', 'ApexPage', 'ApexTrigger', 'AuraDefinitionBundle', 'LightningComponentBundle'],
    nocode: ['Flow', 'ValidationRule'],
    config: ['CustomLabels', 'CustomMetadata', 'CustomField'],
    empty: []
};

// Metadata Type Mapping
const FOLDER_TO_TYPE_MAP = {
    'classes': 'ApexClass', 'pages': 'ApexPage', 'components': 'ApexComponent',
    'triggers': 'ApexTrigger', 'aura': 'AuraDefinitionBundle', 'lwc': 'LightningComponentBundle',
    'objects': 'CustomObject', 'layouts': 'Layout', 'permissionsets': 'PermissionSet',
    'profiles': 'Profile', 'customMetadata': 'CustomMetadata', 'labels': 'CustomLabels',
    'flows': 'Flow', 'workflows': 'Workflow', 'email': 'EmailTemplate',
    'roles': 'Role', 'groups': 'Group', 'queues': 'Queue', 'connectedApps': 'ConnectedApp',
    'approvalProcesses': 'ApprovalProcess', 'assignmentRules': 'AssignmentRule',
    'autoResponseRules': 'AutoResponseRule', 'escalationRules': 'EscalationRule',
    'postTemplate': 'PostTemplate', 'homePageLayouts': 'HomePageLayout',
    'homePageComponents': 'HomePageComponent', 'objectTranslations': 'CustomObjectTranslation',
    'flowDefinitions': 'FlowDefinition', 'weblinks': 'CustomPageWebLink',
    'tabs': 'CustomTab', 'applications': 'CustomApplication',
    'letterhead': 'Letterhead', 'reportTypes': 'ReportType',
    'reports': 'Report', 'dashboards': 'Dashboard'
};

// --- Alpine.js Component for Manifest Builder ---
document.addEventListener('alpine:init', () => {
    Alpine.data('manifestBuilder', () => ({
        searchQuery: '',

        // Comprehensive list of common Salesforce Metadata Types
        allAvailableTypes: [
            'ApexClass', 'ApexComponent', 'ApexPage', 'ApexTrigger', 'AppMenu', 'ApprovalProcess', 'AssignmentRules',
            'AuraDefinitionBundle', 'AuthProvider', 'AutoResponseRules', 'Certificate', 'CleanDataService',
            'Community', 'CompactLayout', 'ConnectedApp', 'ContentAsset', 'CorsWhitelistOrigin', 'CustomApplication',
            'CustomApplicationComponent', 'CustomField', 'CustomLabels', 'CustomMetadata', 'CustomObject',
            'CustomObjectTranslation', 'CustomPageWebLink', 'CustomPermission', 'CustomSite', 'CustomTab',
            'Dashboard', 'DataCategoryGroup', 'DelegateGroup', 'Document', 'DuplicateRule', 'EmailTemplate',
            'EntitlementProcess', 'EntitlementTemplate', 'EscalationRules', 'ExternalDataSource', 'FlexiPage',
            'Flow', 'FlowDefinition', 'GlobalValueSet', 'GlobalValueSetTranslation', 'Group', 'HomePageComponent',
            'HomePageLayout', 'Layout', 'Letterhead', 'LightningComponentBundle', 'ListView', 'MatchingRules',
            'MilestoneType', 'NamedCredential', 'Network', 'PathAssistant', 'PermissionSet', 'PermissionSetGroup',
            'PlatformCachePartition', 'PlatformEventChannel', 'PostTemplate', 'PresenceDeclineReason',
            'PresenceUserConfig', 'Profile', 'ProfilePasswordPolicy', 'ProfileSessionSetting', 'Queue',
            'QueueRoutingConfig', 'QuickAction', 'RecordType', 'RemoteSiteSetting', 'Report', 'ReportType',
            'Role', 'SamlSsoConfig', 'Scontrol', 'ServiceChannel', 'ServicePresenceStatus', 'SharingRules',
            'StandardValueSet', 'StandardValueSetTranslation', 'StaticResource', 'TransactionSecurityPolicy',
            'Translations', 'ValidationRule', 'WebLink', 'Workflow'
        ].sort(),

        selectedTypes: ['ApexClass'], // Default selection

        get filteredAvailableTypes() {
            if (this.searchQuery === '') return this.allAvailableTypes;
            const q = this.searchQuery.toLowerCase();
            return this.allAvailableTypes.filter(t => t.toLowerCase().includes(q));
        },

        get generatedXml() {
            if (this.selectedTypes.length === 0) {
                return `<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n  <version>58.0</version>\n</Package>`;
            }

            let xml = `<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n`;
            this.selectedTypes.forEach(type => {
                xml += `  <types>\n    <members>*</members>\n    <name>${type}</name>\n  </types>\n`;
            });
            xml += `  <version>58.0</version>\n</Package>`;
            return xml;
        },

        addType(type) {
            if (!this.selectedTypes.includes(type)) {
                this.selectedTypes.push(type);
                this.selectedTypes.sort();
            }
        },

        removeType(type) {
            this.selectedTypes = this.selectedTypes.filter(t => t !== type);
        },

        loadPreset(presetName) {
            if (presets[presetName]) {
                this.selectedTypes = [...presets[presetName]].sort();
            }
        }
    }));
});
// ------------------------------------------------
// Utils
function extractZipFromSoap(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    
    // Check for SOAP faults first
    const faultStringNode = xmlDoc.getElementsByTagName("faultstring")[0] || xmlDoc.getElementsByTagName("soapenv:faultstring")[0];
    if (faultStringNode) {
        throw new Error(`SOAP Error: ${faultStringNode.textContent}`);
    }

    const resultNode = xmlDoc.getElementsByTagName("result")[0] || xmlDoc.getElementsByTagName("met:result")[0];
    if (!resultNode) {
        const snippet = (xmlString || "").substring(0, 500);
        throw new Error(`Result node not found in SOAP response. Raw response snippet: ${snippet}`);
    }

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

        setProgress(retrieveProgress, retrieveMsg, 80, 'Fetching Last Modified data...', false);
        await fetchLastModifiedData(srcInstance.value, srcSession.value);

        setProgress(retrieveProgress, retrieveMsg, 100, `Comparison complete. Found ${changedFiles.length} differences.`, false);

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

btnSwapOrgs.addEventListener('click', () => {
    const tempInstance = srcInstance.value;
    const tempSession = srcSession.value;
    const tempAlias = srcOrgAliasLabel.textContent;
    
    srcInstance.value = tgtInstance.value;
    srcSession.value = tgtSession.value;
    srcOrgAliasLabel.textContent = tgtOrgAliasLabel.textContent;
    
    tgtInstance.value = tempInstance;
    tgtSession.value = tempSession;
    tgtOrgAliasLabel.textContent = tempAlias;
});

// --- Application Mode Toggling ---
function setAppMode(mode) {
    const activeTabClasses = ['bg-white', 'text-gray-900', 'dark:bg-gray-600', 'dark:text-white', 'shadow-sm'];
    const inactiveTabClasses = ['text-gray-500', 'hover:text-gray-700', 'dark:text-gray-400', 'dark:hover:text-gray-200', 'bg-transparent'];

    if (mode === 'deploy') {
        tabDeploy.classList.add(...activeTabClasses);
        tabDeploy.classList.remove(...inactiveTabClasses);
        tabHealth.classList.remove(...activeTabClasses);
        tabHealth.classList.add(...inactiveTabClasses);

        targetOrgContainer.classList.remove('hidden');
        deployScopeContainer.classList.remove('hidden');
        healthCheckContainer.classList.add('hidden');
        btnRetrieve.classList.remove('hidden');
        btnAnalyze.classList.add('hidden');

        healthEmptyState.classList.add('hidden');
        dependenciesSection.classList.add('hidden');

        // Restore deploy view
        if (changedFiles && changedFiles.length > 0) {
            diffSection.classList.remove('hidden');
            deployActionBar.style.display = 'flex';
        } else {
            emptyState.classList.remove('hidden');
            deployActionBar.style.display = 'none';
        }
    } else {
        tabHealth.classList.add(...activeTabClasses);
        tabHealth.classList.remove(...inactiveTabClasses);
        tabDeploy.classList.remove(...activeTabClasses);
        tabDeploy.classList.add(...inactiveTabClasses);

        targetOrgContainer.classList.add('hidden');
        deployScopeContainer.classList.add('hidden');
        healthCheckContainer.classList.remove('hidden');
        btnRetrieve.classList.add('hidden');
        btnAnalyze.classList.remove('hidden');

        emptyState.classList.add('hidden');
        diffSection.classList.add('hidden');
        deployActionBar.style.display = 'none';

        if (depList.children.length > 0) {
            dependenciesSection.classList.remove('hidden');
        } else {
            healthEmptyState.classList.remove('hidden');
        }
    }
}
tabDeploy.addEventListener('click', () => setAppMode('deploy'));
tabHealth.addEventListener('click', () => setAppMode('health'));

// --- Health Check Tooling API Flow ---
btnAnalyze.addEventListener('click', async () => {
    const compName = componentNameInput.value.trim();
    if (!compName) return alert("Please enter a component API name");
    if (!srcInstance.value || !srcSession.value) return alert("Please provide Source Org credentials");

    healthEmptyState.classList.add('hidden');
    dependenciesSection.classList.add('hidden');
    btnAnalyze.disabled = true;
    btnAnalyze.innerHTML = `<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Analyzing...`;

    try {
        let resolvedId = compName;
        // If not already a 15/18 char Salesforce ID
        if (!(compName.length >= 15 && compName.length <= 18 && /^[0-9a-zA-Z]+$/.test(compName))) {
            let toolingObj = 'ApexClass';
            let whereField = 'Name';
            let extractName = compName;

            if (compName.includes('.')) {
                toolingObj = 'CustomField';
                extractName = compName.split('.')[1].replace(/__c$/, '');
                whereField = 'DeveloperName';
            } else if (compName.endsWith('__c') || compName.endsWith('__mdt')) {
                toolingObj = 'CustomObject';
                extractName = compName.replace(/__c$/, '').replace(/__mdt$/, '');
                whereField = 'DeveloperName';
            }

            const resolveQuery = `SELECT Id FROM ${toolingObj} WHERE ${whereField} = '${extractName}' LIMIT 1`;
            const resolveUrl = `/api/proxy/tooling/query?instanceUrl=${encodeURIComponent(srcInstance.value)}&sessionId=${encodeURIComponent(srcSession.value)}&q=${encodeURIComponent(resolveQuery)}`;
            
            const resolveRes = await fetch(resolveUrl);
            if (!resolveRes.ok) throw new Error("ID Resolution failed: " + await resolveRes.text());
            
            const resolveData = await resolveRes.json();
            if (resolveData.records && resolveData.records.length > 0) {
                resolvedId = resolveData.records[0].Id;
            } else {
                throw new Error(`Could not resolve Component ID for '${compName}' (searched ${toolingObj}). Please enter the 15/18-character ID directly.`);
            }
        }

        const query = `SELECT MetadataComponentType, MetadataComponentName, MetadataComponentId FROM MetadataComponentDependency WHERE RefMetadataComponentId = '${resolvedId}' LIMIT 2000`;
        const url = `/api/proxy/tooling/query?instanceUrl=${encodeURIComponent(srcInstance.value)}&sessionId=${encodeURIComponent(srcSession.value)}&q=${encodeURIComponent(query)}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(await res.text());

        const data = await res.json();
        const records = data.records || [];

        depList.innerHTML = '';
        if (records.length === 0) {
            depList.innerHTML = `<tr><td colspan="2" class="px-6 py-4 text-center text-gray-500 text-sm italic">No references found for ${compName}. It is safely decoupled.</td></tr>`;
        } else {
            records.forEach(r => {
                const tr = document.createElement('tr');
                
                // Construct the Salesforce Setup URL. 
                // Using frontdoor.jsp to pass the session token so the user is authenticated automatically.
                const baseUrl = srcInstance.value.replace(/\/$/, ''); // Remove trailing slash if any
                const retUrl = encodeURIComponent(`/${r.MetadataComponentId}`);
                const compUrl = `${baseUrl}/secur/frontdoor.jsp?sid=${encodeURIComponent(srcSession.value)}&retURL=${retUrl}`;

                tr.innerHTML = `
                    <td class="px-6 py-3 text-xs text-gray-700 dark:text-gray-300 font-medium">${r.MetadataComponentType}</td>
                    <td class="px-6 py-3 text-xs text-gray-900 dark:text-gray-100">
                        <a href="${compUrl}" target="_blank" class="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline flex items-center gap-1" title="Open in Salesforce Setup">
                            ${r.MetadataComponentName}
                            <svg class="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                        </a>
                    </td>
                `;
                depList.appendChild(tr);
            });
        }

        depCountBadge.textContent = `${records.length} references`;
        dependenciesSection.classList.remove('hidden');
    } catch (e) {
        alert("Tooling API Error: " + e.message);
        healthEmptyState.classList.remove('hidden');
    } finally {
        btnAnalyze.disabled = false;
        btnAnalyze.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg> Analyze Dependencies`;
    }
});

// Demo Data Flow
btnDemo.addEventListener('click', () => {
    changedFiles = [
        {
            name: "unpackaged/classes/AccountTriggerHandler.cls",
            status: "Modified",
            selected: false,
            lastModifiedByName: "Sarah Developer",
            lastModifiedDate: "2023-10-25T14:30:00Z",
            srcContent: "public class AccountTriggerHandler {\n    public static void beforeInsert(List<Account> newAccounts) {\n        for(Account acc : newAccounts) {\n            if(acc.Industry == 'Technology') {\n                acc.Rating = 'Hot';\n                acc.Description = 'Tech Account - Priority';\n            }\n        }\n    }\n    \n    public static void afterInsert(List<Account> newAccounts) {\n        // Call external tracking service\n        IntegrationService.notifyNewAccounts(newAccounts);\n        System.debug('Account creation fully processed');\n    }\n}\n",
            tgtContent: "public class AccountTriggerHandler {\n    public static void beforeInsert(List<Account> newAccounts) {\n        for(Account acc : newAccounts) {\n            if(acc.Industry == 'Technology') {\n                acc.Rating = 'Hot';\n            }\n        }\n    }\n    \n    public static void afterInsert(List<Account> newAccounts) {\n        // Old logic\n        System.debug('Account created');\n    }\n}\n"
        },
        {
            name: "unpackaged/objects/Opportunity.object",
            status: "Modified",
            selected: false,
            lastModifiedByName: "Admin User",
            lastModifiedDate: "2023-10-24T09:15:00Z",
            srcContent: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<CustomObject xmlns=\"http://soap.sforce.com/2006/04/metadata\">\n    <fields>\n        <fullName>Discount__c</fullName>\n        <type>Percent</type>\n    </fields>\n</CustomObject>",
            tgtContent: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<CustomObject xmlns=\"http://soap.sforce.com/2006/04/metadata\">\n    <!-- Missing Discount field -->\n</CustomObject>"
        },
        {
            name: "unpackaged/lwc/customDatatable/customDatatable.js",
            status: "New",
            selected: false,
            lastModifiedByName: "Sarah Developer",
            lastModifiedDate: "2023-10-26T11:45:00Z",
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
            changedFiles.push({ name: fileName, status: 'New', selected: false, srcContent, tgtContent: '', lastModifiedByName: '-', lastModifiedDate: '-' });
        } else {
            const tgtContent = await tgt.file(fileName).async("string");
            if (srcContent !== tgtContent) {
                changedFiles.push({ name: fileName, status: 'Modified', selected: false, srcContent, tgtContent, lastModifiedByName: '-', lastModifiedDate: '-' });
            }
        }
    }
}

async function fetchLastModifiedData(instanceUrl, sessionId) {
    if (changedFiles.length === 0) return;

    const typesNeeded = new Set();
    changedFiles.forEach(f => {
        const parts = f.name.replace('unpackaged/', '').split('/');
        if (parts.length >= 2) {
            const folder = parts[0];
            const type = FOLDER_TO_TYPE_MAP[folder] || folder;
            typesNeeded.add(type);
        }
    });

    const typesArray = Array.from(typesNeeded);
    const metadataResults = [];
    
    const fetchPromises = [];
    for (let i = 0; i < typesArray.length; i += 3) {
        const batch = typesArray.slice(i, i + 3);
        fetchPromises.push(
            fetch('/api/proxy/listMetadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instanceUrl, sessionId, types: batch })
            })
            .then(async res => {
                if (res.ok) {
                    const data = await res.json();
                    if (data.result && Array.isArray(data.result)) {
                        return data.result;
                    }
                } else {
                    console.error('Failed listMetadata batch', await res.text());
                }
                return [];
            })
            .catch(e => {
                console.error('listMetadata Error', e);
                return [];
            })
        );
    }

    const resultsArrays = await Promise.all(fetchPromises);
    resultsArrays.forEach(arr => metadataResults.push(...arr));

    const lookup = {};
    metadataResults.forEach(r => {
        if (!lookup[r.type]) lookup[r.type] = {};
        lookup[r.type][r.fullName] = r;
    });

    changedFiles.forEach(f => {
        const parts = f.name.replace('unpackaged/', '').split('/');
        if (parts.length >= 2) {
            const folder = parts[0];
            const type = FOLDER_TO_TYPE_MAP[folder] || folder;
            let fullName = parts.slice(1).join('/');
            
            const noExtTypes = ['ApexClass', 'ApexTrigger', 'ApexPage', 'ApexComponent', 'CustomObject', 'CustomLabels'];
            if (noExtTypes.includes(type)) {
                fullName = fullName.split('.')[0];
            }

            if (lookup[type] && lookup[type][fullName]) {
                const info = lookup[type][fullName];
                f.lastModifiedByName = info.lastModifiedByName || '-';
                // format date
                let dateStr = info.lastModifiedDate;
                if (dateStr) {
                    try {
                        const d = new Date(dateStr);
                        dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    } catch(e) {}
                }
                f.lastModifiedDate = dateStr || '-';
            }
        }
    });
}

let currentSortColumn = 'name';
let currentSortDirection = 'asc';
const filterInput = document.getElementById('filterInput');

function updateSelectedCount() {
    const selectedCount = changedFiles.filter(f => f.selected).length;
    if (selectedCountText) {
        selectedCountText.textContent = `(${selectedCount} selected)`;
    }
}

diffList.addEventListener('change', (e) => {
    if (e.target.classList.contains('file-checkbox')) {
        const globalIdx = parseInt(e.target.dataset.idx);
        changedFiles[globalIdx].selected = e.target.checked;
        updateSelectedCount();
        
        // Update selectAll state
        const renderedCheckboxes = Array.from(document.querySelectorAll('.file-checkbox'));
        const allChecked = renderedCheckboxes.every(cb => cb.checked);
        selectAll.checked = allChecked && renderedCheckboxes.length > 0;
    }
});

if (filterInput) {
    filterInput.addEventListener('input', () => renderDiffTable());
}
if (showSelectedOnly) {
    showSelectedOnly.addEventListener('change', () => renderDiffTable());
}
if (statusFilter) {
    statusFilter.addEventListener('change', () => renderDiffTable());
}

document.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (currentSortColumn === col) {
            currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            currentSortColumn = col;
            currentSortDirection = 'asc';
        }
        
        // Update sort indicators
        document.querySelectorAll('.sort-indicator').forEach(el => el.textContent = '');
        const indicator = th.querySelector('.sort-indicator');
        if (indicator) {
            indicator.textContent = currentSortDirection === 'asc' ? '↑' : '↓';
        }
        renderDiffTable();
    });
});

function renderDiffTable() {
    diffList.innerHTML = '';
    
    updateSelectedCount();

    if (changedFiles.length === 0) {
        diffList.innerHTML = '<tr><td colspan="4" class="px-6 py-8 text-center text-sm text-gray-500">No differences found. Orgs are perfectly synced for this manifest.</td></tr>';
        deployActionBar.style.display = 'none';
        return;
    }

    let filteredFiles = changedFiles;
    
    // Status Filter
    const sFilter = statusFilter ? statusFilter.value : 'all';
    if (sFilter !== 'all') {
        filteredFiles = filteredFiles.filter(f => f.status.toLowerCase() === sFilter);
    }
    
    // Selected Filter
    const selOnly = showSelectedOnly ? showSelectedOnly.checked : false;
    if (selOnly) {
        filteredFiles = filteredFiles.filter(f => f.selected);
    }

    // Text Filter
    const q = filterInput ? filterInput.value.toLowerCase() : '';
    if (q) {
        filteredFiles = filteredFiles.filter(f => {
            const rawName = f.name.replace('unpackaged/', '');
            const parts = rawName.split('/');
            const typeName = parts.length >= 2 ? (FOLDER_TO_TYPE_MAP[parts[0]] || parts[0]) : 'Unknown';
            const compName = parts.length >= 2 ? parts.slice(1).join('/') : rawName;
            
            return f.status.toLowerCase().includes(q) || 
                   typeName.toLowerCase().includes(q) || 
                   compName.toLowerCase().includes(q) ||
                   (f.lastModifiedByName || '').toLowerCase().includes(q) ||
                   (f.lastModifiedDate || '').toLowerCase().includes(q);
        });
    }

    filteredFiles.sort((a, b) => {
        let valA = '';
        let valB = '';
        
        const rawNameA = a.name.replace('unpackaged/', '');
        const partsA = rawNameA.split('/');
        const typeNameA = partsA.length >= 2 ? (FOLDER_TO_TYPE_MAP[partsA[0]] || partsA[0]) : 'Unknown';
        const compNameA = partsA.length >= 2 ? partsA.slice(1).join('/') : rawNameA;

        const rawNameB = b.name.replace('unpackaged/', '');
        const partsB = rawNameB.split('/');
        const typeNameB = partsB.length >= 2 ? (FOLDER_TO_TYPE_MAP[partsB[0]] || partsB[0]) : 'Unknown';
        const compNameB = partsB.length >= 2 ? partsB.slice(1).join('/') : rawNameB;

        if (currentSortColumn === 'status') {
            valA = a.status || ''; valB = b.status || '';
        } else if (currentSortColumn === 'type') {
            valA = typeNameA; valB = typeNameB;
        } else if (currentSortColumn === 'name') {
            valA = compNameA; valB = compNameB;
        } else if (currentSortColumn === 'lastModifiedByName') {
            valA = a.lastModifiedByName || ''; valB = b.lastModifiedByName || '';
        } else if (currentSortColumn === 'lastModifiedDate') {
            valA = a.lastModifiedDate || ''; valB = b.lastModifiedDate || '';
        }

        if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    diffCountBadge.textContent = `${filteredFiles.length} files`;

    filteredFiles.forEach((f, idx) => {
        const globalIdx = changedFiles.indexOf(f); // Keep reference to original index for showDiff
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer group';
        tr.onclick = (e) => {
            // Prevent opening modal if clicking the checkbox
            if (e.target.tagName.toLowerCase() === 'input') return;
            showDiff(globalIdx);
        };

        const tdCheck = document.createElement('td');
        tdCheck.className = 'px-6 py-4 whitespace-nowrap';
        tdCheck.innerHTML = `<input type="checkbox" class="file-checkbox w-4 h-4 text-salesforce border-gray-300 rounded focus:ring-salesforce cursor-pointer" data-idx="${globalIdx}" ${f.selected ? 'checked' : ''}>`;

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
            typeName = FOLDER_TO_TYPE_MAP[parts[0]] || parts[0];
            compName = parts.slice(1).join('/');
        }

        const tdType = document.createElement('td');
        tdType.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono';
        tdType.textContent = typeName;

        const tdName = document.createElement('td');
        tdName.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-salesforce transition-colors';
        tdName.innerHTML = `<div class="flex items-center gap-2">${compName} <svg class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></div>`;
        
        const tdModBy = document.createElement('td');
        tdModBy.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 truncate max-w-[12rem]';
        tdModBy.textContent = f.lastModifiedByName || '-';
        tdModBy.title = f.lastModifiedByName || '';

        const tdModDate = document.createElement('td');
        tdModDate.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400';
        tdModDate.textContent = f.lastModifiedDate || '-';

        tr.appendChild(tdCheck);
        tr.appendChild(tdStatus);
        tr.appendChild(tdType);
        tr.appendChild(tdName);
        tr.appendChild(tdModBy);
        tr.appendChild(tdModDate);

        diffList.appendChild(tr);
    });

    const renderedCheckboxes = Array.from(document.querySelectorAll('.file-checkbox'));
    const allChecked = renderedCheckboxes.every(cb => cb.checked);
    selectAll.checked = allChecked && renderedCheckboxes.length > 0;
}

selectAll.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    document.querySelectorAll('.file-checkbox').forEach(cb => {
        cb.checked = isChecked;
        const globalIdx = parseInt(cb.dataset.idx);
        changedFiles[globalIdx].selected = isChecked;
    });
    updateSelectedCount();
});

function closeDiff() {
    modal.classList.add('hidden');
}

function showDiff(idx) {
    const f = changedFiles[idx];
    modalTitle.textContent = f.name.replace('unpackaged/', '');

    // Clarify labels - Target = Current Org State, Source = Incoming Changes
    const patch = Diff.createTwoFilesPatch(
        "Target: " + f.name, "Source: " + f.name,
        f.tgtContent, f.srcContent
    );

    // Check if body has dark class
    const currentIsDark = document.documentElement.classList.contains('dark');

    const diffHtml = Diff2Html.html(patch, {
        drawFileList: false,
        matching: 'lines',
        outputFormat: 'side-by-side',
        theme: currentIsDark ? 'dark' : 'light'
    });

    diffViewer.innerHTML = diffHtml;
    modal.classList.remove('hidden');
    // small timeout to allow modal to display before triggering transition
    setTimeout(() => {
        modal.querySelector('.transform').classList.add('scale-100', 'opacity-100');
        modal.querySelector('.transform').classList.remove('scale-95', 'opacity-0');
    }, 10);
}

closeModalBtn.onclick = closeDiff;

// Deploy Flow
btnValidate.addEventListener('click', () => executeDeploy(true));
btnDeploy.addEventListener('click', () => executeDeploy(false));

async function executeDeploy(isCheckOnly) {
    const selectedIndexes = changedFiles.map((f, i) => f.selected ? i : -1).filter(i => i !== -1);
    if (selectedIndexes.length === 0) {
        alert("Please select at least one component to process.");
        return;
    }

    deployStatus.classList.remove('hidden');
    btnValidate.disabled = true;
    btnDeploy.disabled = true;

    try {
        setProgress(deployProgress, deployMsg, 10, 'Building deployment ZIP...', false);

        const deployZip = new JSZip();
        const typesMap = {};

        for (const idx of selectedIndexes) {
            const file = changedFiles[idx];
            deployZip.file(file.name, file.srcContent);

            // Automatically include the corresponding associated metadata or base file
            const isMeta = file.name.endsWith('-meta.xml');
            const correspondingFileName = isMeta ? file.name.replace('-meta.xml', '') : file.name + '-meta.xml';
            
            // srcZip is defined globally during the fetch & compare stage
            if (srcZip && srcZip.file(correspondingFileName)) {
                const correspondingContent = await srcZip.file(correspondingFileName).async("string");
                deployZip.file(correspondingFileName, correspondingContent);
            }

            const parts = file.name.split('/');
            if (parts.length >= 3) {
                const folder = parts[1];
                let filename = parts.slice(2).join('/');
                filename = filename.split('.')[0];
                const typeName = FOLDER_TO_TYPE_MAP[folder] || folder;

                if (!typesMap[typeName]) typesMap[typeName] = new Set();
                typesMap[typeName].add(filename);
            }
        }

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
                testClasses: testClasses,
                checkOnly: isCheckOnly
            })
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Deploy Proxy Error: ${err}`);
        }

        const data = await res.json();
        const jobId = data.jobId;

        const actionStr = isCheckOnly ? "Validation" : "Deploy";
        setProgress(deployProgress, deployMsg, 50, `${actionStr} Job Queued (${jobId}). Polling status...`, false);

        await pollDeployStatus(jobId, tgtInstance.value, tgtSession.value, isCheckOnly);

    } catch (err) {
        setProgress(deployProgress, deployMsg, 100, err.message, true);
    } finally {
        btnValidate.disabled = false;
        btnDeploy.disabled = false;
    }
}

async function pollDeployStatus(jobId, instanceUrl, sessionId, isCheckOnly) {
    let done = false;
    while (!done) {
        await new Promise(r => setTimeout(r, 3000));

        const qs = new URLSearchParams({ instanceUrl, sessionId, apiVersion: '58.0' }).toString();
        const res = await fetch(`/api/proxy/status/${jobId}?${qs}`);
        if (!res.ok) throw new Error("Failed to check deploy status");

        const soapStr = await res.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(soapStr, "text/xml");

        // Check for SOAP fault
        const faultNode = xmlDoc.getElementsByTagName("faultstring")[0] || xmlDoc.getElementsByTagName("soapenv:faultstring")[0];
        if (faultNode) {
            throw new Error(`SOAP Fault during deploy status: ${faultNode.textContent}`);
        }

        const statusNode = xmlDoc.getElementsByTagName("status")[0] || xmlDoc.getElementsByTagName("met:status")[0];
        if (!statusNode) {
            const snippet = (soapStr || "").substring(0, 500);
            throw new Error(`Deploy Status Result node not found. Raw response snippet: ${snippet}`);
        }

        const status = statusNode.textContent;
        const actionStr = isCheckOnly ? "Validation" : "Deploy";
        setProgress(deployProgress, deployMsg, null, `${actionStr} Status: ${status}...`, false);

        if (status === 'Succeeded' || status === 'Failed' || status === 'Canceled') {
            done = true;
            if (status === 'Succeeded') {
                setProgress(deployProgress, deployMsg, 100, `${actionStr} Succeeded! 🎉`, false);
            } else {
                const errNode = xmlDoc.getElementsByTagName("problem")[0] || xmlDoc.getElementsByTagName("met:problem")[0];
                const msg = errNode ? errNode.textContent : `${actionStr} Failed. Check Salesforce for details.`;
                setProgress(deployProgress, deployMsg, 100, msg, true);
            }
        }
    }
}

// --- Org Manager (SFDX Integration) ---
const orgManagerBtn = document.getElementById('orgManagerBtn');
const orgManagerModal = document.getElementById('orgManagerModal');
const closeOrgManager = document.getElementById('closeOrgManager');
const orgManagerModalBg = document.getElementById('orgManagerModalBg');

const sfdxStatusIcon = document.getElementById('sfdxStatusIcon');
const sfdxStatusTitle = document.getElementById('sfdxStatusTitle');
const sfdxStatusDesc = document.getElementById('sfdxStatusDesc');
const sfdxSatusAction = document.getElementById('sfdxSatusAction');

const orgsTableBody = document.getElementById('orgsTableBody');
const btnRefreshOrgs = document.getElementById('btnRefreshOrgs');
const btnAuthorizeOrg = document.getElementById('btnAuthorizeOrg');
const newOrgAlias = document.getElementById('newOrgAlias');
const newOrgType = document.getElementById('newOrgType');

orgManagerBtn.addEventListener('click', () => {
    orgManagerModal.classList.remove('hidden');
    // small timeout to allow modal to display before triggering transition
    setTimeout(() => {
        orgManagerModal.querySelector('.transform').classList.add('scale-100', 'opacity-100');
        orgManagerModal.querySelector('.transform').classList.remove('scale-95', 'opacity-0');
        checkSfdxStatusAndLoadOrgs();
    }, 10);
});

function closeOrgModal() {
    orgManagerModal.classList.add('hidden');
}

closeOrgManager.addEventListener('click', closeOrgModal);
orgManagerModalBg.addEventListener('click', closeOrgModal);
btnRefreshOrgs.addEventListener('click', loadOrgs);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (modal && !modal.classList.contains('hidden')) {
            closeDiff();
        }
        if (orgManagerModal && !orgManagerModal.classList.contains('hidden')) {
            closeOrgModal();
        }
    }
});

async function checkSfdxStatusAndLoadOrgs() {
    try {
        const res = await fetch('/api/sfdx/status');
        const data = await res.json();

        if (data.installed) {
            sfdxStatusIcon.className = "w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]";
            sfdxStatusTitle.textContent = `Salesforce CLI Installed (${data.cli})`;
            sfdxStatusTitle.className = "text-sm font-medium text-emerald-900 dark:text-emerald-400";
            sfdxStatusDesc.textContent = `Version: ${data.version.split(' ')[1] || data.version}`;
            sfdxSatusAction.innerHTML = '';

            await loadOrgs();
        } else {
            sfdxStatusIcon.className = "w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]";
            sfdxStatusTitle.textContent = "Salesforce CLI Not Found";
            sfdxStatusTitle.className = "text-sm font-medium text-red-900 dark:text-red-400";
            sfdxStatusDesc.textContent = "Please install 'sf' or 'sfdx' CLI on your machine to use the Org Manager.";
            sfdxSatusAction.innerHTML = `<a href="https://developer.salesforce.com/tools/sfdxcli" target="_blank" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Download CLI &rarr;</a>`;
            orgsTableBody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-red-500 dark:text-red-400">Salesforce CLI is required to list orgs.</td></tr>`;
            btnAuthorizeOrg.disabled = true;
            btnRefreshOrgs.disabled = true;
        }
    } catch (e) {
        console.error("Status check failed", e);
    }
}

async function loadOrgs() {
    orgsTableBody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400"><svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-500 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Loading orgs...</td></tr>`;
    btnRefreshOrgs.disabled = true;

    try {
        const res = await fetch('/api/sfdx/orgs');
        if (!res.ok) throw new Error("Failed to fetch orgs");
        const data = await res.json();

        const orgs = [...(data.result.nonScratchOrgs || []), ...(data.result.scratchOrgs || [])];
        renderOrgsTable(orgs);
    } catch (e) {
        orgsTableBody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-red-500 dark:text-red-400">Error loading orgs: ${e.message}</td></tr>`;
    } finally {
        btnRefreshOrgs.disabled = false;
    }
}

function renderOrgsTable(orgs) {
    if (!orgs || orgs.length === 0) {
        orgsTableBody.innerHTML = `<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No authenticated orgs found. Use "Connect New Environment" above.</td></tr>`;
        return;
    }

    orgsTableBody.innerHTML = '';

    orgs.forEach(org => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors';

        const isConnected = org.connectedStatus === 'Connected' || org.connectedStatus === 'Unknown' || !org.connectedStatus;
        const statusBadge = isConnected
            ? `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"><div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div> Connected</span>`
            : `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800/50"><div class="w-1.5 h-1.5 rounded-full bg-red-500"></div> Expired</span>`;

        // Action Buttons
        const btnClasses = "px-2.5 py-1 text-xs font-medium rounded border transition-colors focus:outline-none";
        const btnSource = `<button onclick="setOrgTarget('source', '${org.targetOrg || org.username}', '${org.alias || ''}')" class="${btnClasses} bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50 dark:hover:bg-blue-900/50 shadow-sm" ${!isConnected ? 'disabled' : ''}>Set Source</button>`;
        const btnTarget = `<button onclick="setOrgTarget('target', '${org.targetOrg || org.username}', '${org.alias || ''}')" class="${btnClasses} bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50 dark:hover:bg-emerald-900/50 shadow-sm" ${!isConnected ? 'disabled' : ''}>Set Target</button>`;
        const btnOpen = `<button onclick="openOrg('${org.targetOrg || org.username}')" class="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 dark:text-gray-400 dark:hover:text-indigo-400 rounded transition-colors" title="Open in Browser" ${!isConnected ? 'disabled' : ''}><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg></button>`;

        tr.innerHTML = `
            <td class="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">${org.alias || '-'}</td>
            <td class="px-4 py-3 text-gray-500 dark:text-gray-400 w-full">${org.username}</td>
            <td class="px-4 py-3">${statusBadge}</td>
            <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-2">
                    ${btnSource}
                    ${btnTarget}
                    <div class="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1"></div>
                    ${btnOpen}
                </div>
            </td>
        `;
        orgsTableBody.appendChild(tr);
    });
}

// Global functions for inline handlers
window.openOrg = async function (username) {
    try {
        await fetch('/api/sfdx/open', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetOrg: username })
        });
    } catch (e) {
        console.error("Failed to open org", e);
        alert("Failed to open org. Check console for details.");
    }
};

window.setOrgTarget = async function (side, username, alias) {
    const instanceElem = side === 'source' ? srcInstance : tgtInstance;
    const sessionElem = side === 'source' ? srcSession : tgtSession;
    const labelElem = side === 'source' ? srcOrgAliasLabel : tgtOrgAliasLabel;

    sessionElem.value = "Fetching token...";
    labelElem.textContent = alias ? `[${alias}]` : '';

    try {
        const res = await fetch(`/api/sfdx/token/${username}`);
        if (!res.ok) throw new Error("Failed to fetch fresh token");
        const data = await res.json();

        instanceElem.value = data.instanceUrl;
        sessionElem.value = data.accessToken;

    } catch (e) {
        console.error("Token fetch failed", e);
        sessionElem.value = "";
        alert(`Failed to fetch session token for ${username}. Wait a few seconds or try authorizing again.`);
    }
};

btnAuthorizeOrg.addEventListener('click', async () => {
    const alias = newOrgAlias.value.trim();
    if (!alias) {
        alert("Please provide an alias.");
        return;
    }

    const origBtnHtml = btnAuthorizeOrg.innerHTML;
    btnAuthorizeOrg.disabled = true;
    btnAuthorizeOrg.innerHTML = `<svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Waiting for Browser...`;

    try {
        const reqBody = { alias: alias };
        if (newOrgType.value) reqBody.instanceUrl = newOrgType.value;

        const res = await fetch('/api/sfdx/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reqBody)
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(err);
        }

        newOrgAlias.value = '';
        await loadOrgs();

    } catch (e) {
        console.error("Login failed", e);
        alert("Authorization failed or timed out.");
    } finally {
        btnAuthorizeOrg.disabled = false;
        btnAuthorizeOrg.innerHTML = origBtnHtml;
    }
});
