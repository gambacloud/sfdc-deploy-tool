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

const tgtOrgAliasLabel = document.getElementById('tgtOrgAliasLabel');
const fastCompareToggle = document.getElementById('fastCompareToggle');

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

// Salesforce Setup URL builder
function getSfSetupUrl(instanceUrl, typeName, componentName) {
    if (!instanceUrl) return null;
    const base = instanceUrl.replace(/\/$/, '');
    // Strip file extension for the component name
    const name = componentName.replace(/\.(cls|trigger|page|component|js|css|html|xml|cmp|design|svg|app)(-meta\.xml)?$/i, '');
    const searchBase = `${base}/lightning/setup`;
    const typeMap = {
        'ApexClass': `${searchBase}/ApexClasses/home`,
        'ApexTrigger': `${searchBase}/ApexTriggers/home`,
        'ApexPage': `${searchBase}/ApexPages/home`,
        'ApexComponent': `${searchBase}/ApexComponents/home`,
        'LightningComponentBundle': `${searchBase}/LightningComponentBundles/home`,
        'AuraDefinitionBundle': `${searchBase}/LightningComponentBundles/home`,
        'Flow': `${searchBase}/Flows/home`,
        'CustomObject': `${searchBase}/ObjectManager/${name}/Details/view`,
        'Layout': `${searchBase}/ObjectManager/home`,
        'PermissionSet': `${searchBase}/PermSets/home`,
        'Profile': `${searchBase}/Profiles/home`,
        'ValidationRule': `${searchBase}/ObjectManager/home`,
        'CustomLabels': `${searchBase}/ExternalStrings/home`,
        'CustomMetadata': `${searchBase}/CustomMetadata/home`,
    };
    return typeMap[typeName] || null;
}

// --- Alpine.js Component for Manifest Builder ---
// --- Alpine.js Store for Member Selection ---
document.addEventListener('alpine:init', () => {
    Alpine.store('members', {
        show: false,
        loading: false,
        type: '',
        searchQuery: '',
        all: [],
        
        get filtered() {
            if (!this.all || !Array.isArray(this.all)) return [];
            if (!this.searchQuery) return this.all;
            const q = this.searchQuery.toLowerCase();
            return this.all.filter(m => m && typeof m === 'string' && m.toLowerCase().includes(q));
        },

        async open(type, instanceUrl, sessionId) {
            this.type = type;
            this.show = true;
            this.loading = true;
            this.all = [];
            this.searchQuery = '';

            try {
                // Use the same logic as fetchMetadata to decide if we use SOQL or listMetadata
                const soqlSupportedTypes = ['ApexClass', 'ApexTrigger', 'ApexPage', 'ApexComponent', 'CustomObject', 'CustomMetadata'];
                if (soqlSupportedTypes.includes(type)) {
                    let q = "";
                    if (type === 'CustomObject' || type === 'CustomMetadata') {
                        const isCmdt = (type === 'CustomMetadata');
                        q = `SELECT QualifiedApiName FROM EntityDefinition WHERE IsCustomMetadataDefinition = ${isCmdt}`;
                    } else {
                        q = `SELECT Name FROM ${type}`;
                    }
                    
                    const url = `/api/proxy/query?instanceUrl=${encodeURIComponent(instanceUrl)}&sessionId=${encodeURIComponent(sessionId)}&q=${encodeURIComponent(q)}`;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error(await res.text());
                    const data = await res.json();
                    const rawMembers = (data.records || []).map(r => r.Name || r.QualifiedApiName).filter(Boolean);
                    this.all = [...new Set(rawMembers)].sort();
                } else {
                    // Fallback to listMetadata
                    const res = await fetch('/api/proxy/listMetadata', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ instanceUrl, sessionId, types: [type] })
                    });
                    if (!res.ok) throw new Error(await res.text());
                    const data = await res.json();
                    const rawMembers = (data.result || []).map(r => r.fullName).filter(Boolean);
                    this.all = [...new Set(rawMembers)].sort();
                }
            } catch (e) {
                console.error("Error loading members:", e);
                alert("Failed to load members: " + e.message);
            } finally {
                this.loading = false;
            }
        },

        isSelected(member) {
            return false;
        },
        toggle(member) { },
        clear() { },
        selectedCount() { return 0; }
    });

    Alpine.data('manifestBuilder', () => ({
        searchQuery: '',
        memberSelections: {}, // type -> Array of names

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

        selectedTypes: ['ApexClass'],

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
                xml += `  <types>\n`;
                const members = this.memberSelections[type] || [];
                if (members.length === 0) {
                    xml += `    <members>*</members>\n`;
                } else {
                    members.forEach(m => {
                        xml += `    <members>${m}</members>\n`;
                    });
                }
                xml += `    <name>${type}</name>\n  </types>\n`;
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
            delete this.memberSelections[type];
        },

        loadPreset(presetName) {
            if (presets[presetName]) {
                this.selectedTypes = [...presets[presetName]].sort();
                this.memberSelections = {};
            }
        },

        browseMembers(type) {
            if (!srcInstance.value || !srcSession.value) return alert("Please provide Source Org credentials first.");
            
            // Link store to this instance
            Alpine.store('members').isSelected = (member) => {
                return (this.memberSelections[type] || []).includes(member);
            };
            Alpine.store('members').toggle = (member) => {
                if (!this.memberSelections[type]) this.memberSelections[type] = [];
                const idx = this.memberSelections[type].indexOf(member);
                if (idx > -1) this.memberSelections[type].splice(idx, 1);
                else this.memberSelections[type].push(member);
            };
            Alpine.store('members').clear = () => {
                this.memberSelections[type] = [];
            };
            Alpine.store('members').selectedCount = () => {
                return (this.memberSelections[type] || []).length;
            };

            Alpine.store('members').open(type, srcInstance.value, srcSession.value);
        }
    }));

    Alpine.store('deploy', {
        show: false,
        status: 'Idle',
        progress: 0,
        jobId: '',
        isCheckOnly: false,
        logs: [],
        deployed: 0,
        total: 0,
        errors: 0,
        coverage: 0,
        classCoverage: [],
        processedIds: new Set(), // To avoid duplicate logs

        reset(isCheckOnly) {
            this.show = false;
            this.status = 'Queued';
            this.progress = 0;
            this.jobId = 'Pending...';
            this.isCheckOnly = isCheckOnly;
            this.logs = [];
            this.deployed = 0;
            this.total = 0;
            this.errors = 0;
            this.coverage = 0;
            this.classCoverage = [];
            this.processedIds = new Set();
            
            // Clear the actual terminal DOM if needed, though logs is reactive
            this.addLog('info', `Initializing ${isCheckOnly ? 'validation' : 'deployment'} sequence...`);
        },

        addLog(type, msg, id = null) {
            if (id && this.processedIds.has(id)) return;
            if (id) this.processedIds.add(id);

            this.logs.push({
                id: Date.now() + Math.random(),
                type: type || 'default',
                msg: msg
            });

            // Auto-scroll terminal
            setTimeout(() => {
                const el = document.getElementById('terminalLog');
                if (el) el.scrollTop = el.scrollHeight;
            }, 10);
        }
    });
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

async function fetchMetadata(instanceUrl, sessionId, xmlPayload, useFastCompare = false) {
    let finalZip = new JSZip();
    let typesToRetrieve = []; // Array of objects { name, members }

    // 1. Parse XML payload to know what to fetch
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlPayload, "text/xml");
    const typesNodes = xmlDoc.getElementsByTagName("types");
    
    for (const typeNode of typesNodes) {
        const nameNode = typeNode.getElementsByTagName("name")[0];
        if (nameNode) {
            const typeName = nameNode.textContent;
            const members = [];
            const memberNodes = typeNode.getElementsByTagName("members");
            for (const m of memberNodes) {
                members.push(m.textContent);
            }
            typesToRetrieve.push({ name: typeName, members: members });
        }
    }

    // 2. Identify Fast Types vs Slow Types
    const supportedFastTypes = ['ApexClass', 'ApexTrigger', 'ApexComponent', 'ApexPage'];
    const fastTypes = [];
    const slowTypes = [];

    if (useFastCompare) {
        typesToRetrieve.forEach(t => {
            if (supportedFastTypes.includes(t.name)) fastTypes.push(t);
            else slowTypes.push(t);
        });
    } else {
        slowTypes.push(...typesToRetrieve);
    }

    // 3. Prepare Concurrent Promises
    const promises = [];

    // 3a. Standard Metadata API Retrieve for Slow Types
    if (slowTypes.length > 0) {
        // Build a restricted package.xml just for the slow types
        let restrictedXml = `<Package xmlns="http://soap.sforce.com/2006/04/metadata">\n`;
        slowTypes.forEach(type => {
            restrictedXml += `  <types>\n`;
            type.members.forEach(m => {
                restrictedXml += `    <members>${m}</members>\n`;
            });
            restrictedXml += `    <name>${type.name}</name>\n  </types>\n`;
        });
        restrictedXml += `  <version>58.0</version>\n</Package>`;

        const mdPromise = fetch('/api/proxy/retrieve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceUrl, sessionId, unpackagedXml: restrictedXml })
        }).then(async res => {
            if (!res.ok) throw new Error(`Proxy Error: ${await res.text()}`);
            const soapStr = await res.text();
            const base64 = extractZipFromSoap(soapStr);
            const mdZip = new JSZip();
            await mdZip.loadAsync(base64, { base64: true });
            
            // Merge into finalZip
            mdZip.forEach((relativePath, file) => {
                finalZip.file(relativePath, file.async('arraybuffer'));
            });
        });
        promises.push(mdPromise);
    }

    // 3b. REST API Fast Fetch for Code
    if (fastTypes.length > 0) {
        const restPromise = fetchCodeViaRestApi(instanceUrl, sessionId, fastTypes).then(fastZip => {
            // Merge into finalZip
            fastZip.forEach((relativePath, file) => {
                finalZip.file(relativePath, file.async('arraybuffer'));
            });
        });
        promises.push(restPromise);
    }

    // 4. Wait for Both Streams
    await Promise.all(promises);

    return finalZip;
}

async function fetchCodeViaRestApi(instanceUrl, sessionId, typeConfigs) {
    const zip = new JSZip();
    
    const fetchType = async (config) => {
        const type = config.name;
        const members = config.members;
        
        let folder = "";
        let ext = "";
        
        if (type === 'ApexClass') { folder = "classes"; ext = ".cls"; }
        else if (type === 'ApexTrigger') { folder = "triggers"; ext = ".trigger"; }
        else if (type === 'ApexPage') { folder = "pages"; ext = ".page"; }
        else if (type === 'ApexComponent') { folder = "components"; ext = ".component"; }

        // Query code
        let where = "";
        if (members.length > 0 && !members.includes('*')) {
            const escapedNames = members.map(m => `'${m}'`).join(',');
            where = ` WHERE Name IN (${escapedNames})`;
        }
        
        // ApexClass/Trigger use 'Body', ApexPage/Component use 'Markup'
        const contentField = (type === 'ApexPage' || type === 'ApexComponent') ? 'Markup' : 'Body';
        const q = `SELECT Name, ${contentField}, ApiVersion, Status, NamespacePrefix FROM ${type}${where}`;
        const url = `/api/proxy/query?instanceUrl=${encodeURIComponent(instanceUrl)}&sessionId=${encodeURIComponent(sessionId)}&q=${encodeURIComponent(q)}`;
        
        const res = await fetch(url);
        if (!res.ok) throw new Error(`REST API Error for ${type}: ${await res.text()}`);
        
        const data = await res.json();
        
        // Assemble Virtual Files
        for (const record of (data.records || [])) {
            // Respect namespaces
            const prefix = record.NamespacePrefix ? `${record.NamespacePrefix}__` : '';
            const fileName = `${prefix}${record.Name}${ext}`;
            const compPath = `unpackaged/${folder}/${fileName}`;
            const metaPath = `unpackaged/${folder}/${fileName}-meta.xml`;

            // The code body is either in Body (Class/Trigger) or Markup (Page/Component)
            const bodyContent = record.Body || record.Markup || '';
            zip.file(compPath, bodyContent);

            // Generate virtual meta.xml
            let metaStatus = record.Status ? `<status>${record.Status}</status>\n` : '';
            let metaApi = record.ApiVersion ? `<apiVersion>${record.ApiVersion}</apiVersion>\n` : '';
            
            // Generate valid meta xml envelope based on type
            let metaXml = `<?xml version="1.0" encoding="UTF-8"?>\n<${type} xmlns="http://soap.sforce.com/2006/04/metadata">\n`;
            if (type === 'ApexPage' || type === 'ApexComponent') {
                metaXml += `    <label>${record.Name}</label>\n`;
            }
            if (metaApi) metaXml += `    ${metaApi}`;
            if (metaStatus) metaXml += `    ${metaStatus}`;
            metaXml += `</${type}>`;

            zip.file(metaPath, metaXml);
        }
    };

    const typePromises = typeConfigs.map(t => fetchType(t));
    await Promise.all(typePromises);
    
    // Virtual package.xml
    zip.file('unpackaged/package.xml', '<?xml version="1.0" encoding="UTF-8"?><Package><version>58.0</version></Package>');
    
    return zip;
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
        const useFastCompare = fastCompareToggle ? fastCompareToggle.checked : false;

        const [src, tgt] = await Promise.all([
            fetchMetadata(srcInstance.value, srcSession.value, xml, useFastCompare).catch(e => { throw new Error(`Source Org Error: ${e.message}`); }),
            fetchMetadata(tgtInstance.value, tgtSession.value, xml, useFastCompare).catch(e => { throw new Error(`Target Org Error: ${e.message}`); })
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
    const totalFiles = srcFiles.length;

    for (let i = 0; i < totalFiles; i++) {
        const fileName = srcFiles[i];
        const srcContent = await src.file(fileName).async("string");

        if (i % 5 === 0 || i === totalFiles - 1) {
            const pct = 10 + Math.floor((i / totalFiles) * 50); // Map 0-100% of comparison to 10-60% of total
            setProgress(retrieveProgress, retrieveMsg, pct, `Comparing files (${i + 1}/${totalFiles})...`, false);
        }

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
    
    // --- SOQL Optimized Path ---
    const soqlSupportedTypes = ['ApexClass', 'ApexTrigger', 'ApexPage', 'ApexComponent', 'CustomObject', 'CustomMetadata'];
    const codes = ['ApexClass', 'ApexTrigger', 'ApexPage', 'ApexComponent'];
    const fastMetadataTypes = typesArray.filter(t => soqlSupportedTypes.includes(t));
    const slowMetadataTypes = typesArray.filter(t => !soqlSupportedTypes.includes(t));

    const fetchPromises = [];

    // 1. Fetch Code info via SOQL
    codes.filter(t => fastMetadataTypes.includes(t)).forEach(type => {
        const q = `SELECT Name, LastModifiedDate, LastModifiedBy.Name FROM ${type}`;
        const url = `/api/proxy/query?instanceUrl=${encodeURIComponent(instanceUrl)}&sessionId=${encodeURIComponent(sessionId)}&q=${encodeURIComponent(q)}`;
        fetchPromises.push(fetch(url).then(async res => {
            if (!res.ok) return [];
            const data = await res.json();
            return (data.records || []).map(r => ({
                fullName: r.Name,
                type: type,
                lastModifiedByName: r.LastModifiedBy?.Name,
                lastModifiedDate: r.LastModifiedDate
            }));
        }));
    });

    // 2. Fetch Entity info (Objects/CMDT) via SOQL
    if (fastMetadataTypes.includes('CustomObject') || fastMetadataTypes.includes('CustomMetadata')) {
        let where = "";
        if (fastMetadataTypes.includes('CustomObject') && !fastMetadataTypes.includes('CustomMetadata')) where = "WHERE IsCustomMetadataDefinition = false";
        else if (!fastMetadataTypes.includes('CustomObject') && fastMetadataTypes.includes('CustomMetadata')) where = "WHERE IsCustomMetadataDefinition = true";

        const q = `SELECT QualifiedApiName, LastModifiedDate, LastModifiedBy.Name, IsCustomMetadataDefinition FROM EntityDefinition ${where}`;
        const url = `/api/proxy/query?instanceUrl=${encodeURIComponent(instanceUrl)}&sessionId=${encodeURIComponent(sessionId)}&q=${encodeURIComponent(q)}`;
        fetchPromises.push(fetch(url).then(async res => {
            if (!res.ok) return [];
            const data = await res.json();
            return (data.records || []).map(r => ({
                fullName: r.QualifiedApiName,
                type: r.IsCustomMetadataDefinition ? 'CustomMetadata' : 'CustomObject',
                lastModifiedByName: r.LastModifiedBy?.Name,
                lastModifiedDate: r.LastModifiedDate
            }));
        }));
    }

    // 3. Fallback for Slow Types (listMetadata)
    for (let i = 0; i < slowMetadataTypes.length; i += 3) {
        const batch = slowMetadataTypes.slice(i, i + 3);
        fetchPromises.push(
            fetch('/api/proxy/listMetadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instanceUrl, sessionId, types: batch })
            })
            .then(async res => {
                if (res.ok) {
                    const data = await res.json();
                    return data.result || [];
                }
                return [];
            })
        );
    }

    // 4. Wait & Merge results
    const resultsArrays = await Promise.all(fetchPromises.map((p, idx) => 
        p.then(res => {
            const pct = 60 + Math.floor(((idx + 1) / fetchPromises.length) * 20);
            setProgress(retrieveProgress, retrieveMsg, pct, `Updating metadata info...`, false);
            return res;
        }).catch(e => {
            console.error('Fetch error:', e);
            return [];
        })
    ));
    
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

    // Show Source → Target direction
    const dirLabel = document.getElementById('orgDirectionLabel');
    if (dirLabel) {
        try {
            const srcHost = srcInstance.value ? new URL(srcInstance.value).hostname.split('.')[0] : 'Source';
            const tgtHost = tgtInstance.value ? new URL(tgtInstance.value).hostname.split('.')[0] : 'Target';
            dirLabel.textContent = `${srcHost} → ${tgtHost}`;
        } catch(e) { dirLabel.textContent = ''; }
    }

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
        
        // Build Setup link for Source org
        const setupUrl = getSfSetupUrl(srcInstance.value, typeName, compName);
        const linkIcon = `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>`;
        if (setupUrl) {
            tdName.innerHTML = `<div class="flex items-center gap-2">${compName} <a href="${setupUrl}" target="_blank" rel="noopener" class="opacity-0 group-hover:opacity-100 transition-opacity text-salesforce hover:text-blue-700" title="Open in Source Org Setup" onclick="event.stopPropagation()">${linkIcon}</a></div>`;
        } else {
            tdName.innerHTML = `<div class="flex items-center gap-2">${compName}</div>`;
        }
        
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
    const cleanName = f.name.replace('unpackaged/', '');
    
    // Build header with org labels
    const srcLabel = srcInstance.value ? new URL(srcInstance.value).hostname.split('.')[0] : 'Source';
    const tgtLabel = tgtInstance.value ? new URL(tgtInstance.value).hostname.split('.')[0] : 'Target';
    modalTitle.innerHTML = `<span class="text-lg font-bold">${cleanName}</span>
        <span class="ml-3 text-xs font-mono text-gray-400">⬅ ${tgtLabel} &nbsp;|&nbsp; ➡ ${srcLabel}</span>`;

    // Clarify labels - Left = Target (current), Right = Source (incoming)
    const patch = Diff.createTwoFilesPatch(
        `⬅ TARGET (${tgtLabel})`, `➡ SOURCE (${srcLabel})`,
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

if (closeModalBtn) closeModalBtn.onclick = closeDiff;

// Deploy Flow
btnValidate.addEventListener('click', () => executeDeploy(true));
btnDeploy.addEventListener('click', () => executeDeploy(false));

async function executeDeploy(isCheckOnly) {
    const selectedIndexes = changedFiles.map((f, i) => f.selected ? i : -1).filter(i => i !== -1);
    if (selectedIndexes.length === 0) {
        alert("Please select at least one component to process.");
        return;
    }

    // Initialize Terminal Overlay
    Alpine.store('deploy').reset(isCheckOnly);

    deployStatus.classList.remove('hidden');
    btnValidate.disabled = true;
    btnDeploy.disabled = true;

    try {
        Alpine.store('deploy').addLog('info', 'Building deployment ZIP package...');
        setProgress(deployProgress, deployMsg, 10, 'Building deployment ZIP...', false);

        const deployZip = new JSZip();
        // ... (rest of zip logic remains same)
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
        Alpine.store('deploy').jobId = jobId;

        const actionStr = isCheckOnly ? "Validation" : "Deploy";
        Alpine.store('deploy').addLog('info', `${actionStr} job queued to Salesforce.`);
        setProgress(deployProgress, deployMsg, 50, `${actionStr} Job Queued (${jobId}). Polling status...`, false);

        await pollDeployStatus(jobId, tgtInstance.value, tgtSession.value, isCheckOnly);

    } catch (err) {
        Alpine.store('deploy').addLog('error', `Deployment Failed: ${err.message}`);
        Alpine.store('deploy').status = 'Failed';
        setProgress(deployProgress, deployMsg, 100, err.message, true);
    } finally {
        btnValidate.disabled = false;
        btnDeploy.disabled = false;
    }
}

async function pollDeployStatus(jobId, instanceUrl, sessionId, isCheckOnly) {
    let done = false;
    const store = Alpine.store('deploy');

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
        store.status = status;
        
        // --- Aggressive Parsing for Terminal ---
        const details = xmlDoc.getElementsByTagName("details")[0] || xmlDoc.getElementsByTagName("met:details")[0];
        if (details) {
            // 1. Successes
            const successes = details.getElementsByTagName("componentSuccesses") || details.getElementsByTagName("met:componentSuccesses");
            for (const s of successes) {
                const name = s.getElementsByTagName("fullName")[0]?.textContent;
                const type = s.getElementsByTagName("componentType")[0]?.textContent;
                if (name && type && !name.includes('package.xml')) {
                    store.addLog('success', `Component: ${type} - ${name} ... Success`, `succ_${name}`);
                }
            }

            // 2. Failures
            const failures = details.getElementsByTagName("componentFailures") || details.getElementsByTagName("met:componentFailures");
            for (const f of failures) {
                const name = f.getElementsByTagName("fullName")[0]?.textContent;
                const problem = f.getElementsByTagName("problem")[0]?.textContent;
                if (name && problem) {
                    store.addLog('error', `Error in ${name}: ${problem}`, `fail_${name}`);
                    store.errors++;
                }
            }

            // 3. Tests
            const testResult = details.getElementsByTagName("runTestResult")[0] || details.getElementsByTagName("met:runTestResult")[0];
            if (testResult) {
                const testSuccesses = testResult.getElementsByTagName("successes") || testResult.getElementsByTagName("met:successes");
                for (const ts of testSuccesses) {
                    const mName = ts.getElementsByTagName("methodName")[0]?.textContent;
                    const cName = ts.getElementsByTagName("name")[0]?.textContent;
                    if (mName) store.addLog('info', `Test Passed: ${cName}.${mName}`, `test_${cName}_${mName}`);
                }

                const testFailures = testResult.getElementsByTagName("failures") || testResult.getElementsByTagName("met:failures");
                for (const tf of testFailures) {
                    const mName = tf.getElementsByTagName("methodName")[0]?.textContent;
                    const cName = tf.getElementsByTagName("name")[0]?.textContent;
                    const msg = tf.getElementsByTagName("message")[0]?.textContent;
                    if (mName) store.addLog('error', `Test Failed: ${cName}.${mName} - ${msg}`, `test_fail_${cName}_${mName}`);
                }

                // Coverage
                const coverageList = testResult.getElementsByTagName("codeCoverage") || testResult.getElementsByTagName("met:codeCoverage");
                let totalLocations = 0;
                let totalUncovered = 0;
                const classCov = [];

                for (const c of coverageList) {
                    const cName = c.getElementsByTagName("name")[0]?.textContent;
                    const numUncovered = parseInt(c.getElementsByTagName("numLocationsNotCovered")[0]?.textContent) || 0;
                    const numTotal = parseInt(c.getElementsByTagName("numLocations")[0]?.textContent) || 0;
                    
                    if (numTotal > 0) {
                        const pct = Math.round(((numTotal - numUncovered) / numTotal) * 100);
                        classCov.push({ name: cName, pct: pct });
                        totalLocations += numTotal;
                        totalUncovered += numUncovered;
                    }
                }
                
                if (totalLocations > 0) {
                    store.coverage = Math.round(((totalLocations - totalUncovered) / totalLocations) * 100);
                    store.classCoverage = classCov.sort((a, b) => a.pct - b.pct);
                }
            }
        }

        // --- Standard Progress logic ---
        let progressPct = null;
        let progressMsg = "";
        
        const deployedNode = xmlDoc.getElementsByTagName("numberComponentsDeployed")[0] || xmlDoc.getElementsByTagName("met:numberComponentsDeployed")[0];
        const totalNode = xmlDoc.getElementsByTagName("numberComponentsTotal")[0] || xmlDoc.getElementsByTagName("met:numberComponentsTotal")[0];
        const testsDeployedNode = xmlDoc.getElementsByTagName("numberTestsCompleted")[0] || xmlDoc.getElementsByTagName("met:numberTestsCompleted")[0];
        const testsTotalNode = xmlDoc.getElementsByTagName("numberTestsTotal")[0] || xmlDoc.getElementsByTagName("met:numberTestsTotal")[0];

        if (deployedNode && totalNode) {
            const deployed = parseInt(deployedNode.textContent) || 0;
            const total = parseInt(totalNode.textContent) || 0;
            const testsDone = parseInt(testsDeployedNode?.textContent) || 0;
            const testsTotal = parseInt(testsTotalNode?.textContent) || 0;
            
            store.deployed = deployed;
            store.total = total;

            if (total > 0) {
                // components are roughly 0-70% of wait time, tests 70-100%
                const compRatio = deployed / total;
                const testRatio = testsTotal > 0 ? (testsDone / testsTotal) : 0;
                
                if (testsTotal > 0) {
                    progressPct = Math.floor(50 + (compRatio * 20) + (testRatio * 30));
                    progressMsg = `Components: ${deployed}/${total}, Tests: ${testsDone}/${testsTotal}`;
                } else {
                    progressPct = Math.floor(50 + (compRatio * 50));
                    progressMsg = `Components: ${deployed}/${total}`;
                }
            }
        }

        if (progressPct !== null) store.progress = progressPct;

        const actionStr = isCheckOnly ? "Validation" : "Deploy";
        setProgress(deployProgress, deployMsg, progressPct, `${actionStr} Status: ${status}. ${progressMsg}`, false);

        if (status === 'Succeeded' || status === 'Failed' || status === 'Canceled') {
            done = true;
            if (status === 'Succeeded') store.addLog('success', `${actionStr} completed successfully.`);
            else store.addLog('error', `${actionStr} finished with status: ${status}`);
        }
    }
}

// --- Snapshot Utility ---
window.takeScreenshot = async (btn) => {
    try {
        const originalIcon = btn.innerHTML;
        btn.innerHTML = `<svg class="animate-spin w-4 h-4 text-salesforce" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        
        await new Promise(r => setTimeout(r, 100));

        const canvas = await html2canvas(document.body, {
            backgroundColor: document.documentElement.classList.contains('dark') ? '#111827' : '#f9fafb',
            windowWidth: document.body.scrollWidth,
            windowHeight: document.body.scrollHeight,
            useCORS: true,
            logging: false
        });

        canvas.toBlob(async (blob) => {
            if (!blob) throw new Error("Canvas capture failed");
            try {
                const clipboardItem = new ClipboardItem({ "image/png": blob });
                await navigator.clipboard.write([clipboardItem]);
                btn.innerHTML = `<svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
            } catch (err) {
                console.error('Clipboard error:', err);
                alert('Could not save to clipboard.');
            }
            setTimeout(() => btn.innerHTML = originalIcon, 2000);
        }, "image/png");

    } catch (err) {
        console.error("Screenshot failed:", err);
        alert("Screenshot failed.");
    }
};

// Listeners for both screenshot buttons
document.getElementById('screenshotBtn')?.addEventListener('click', (e) => window.takeScreenshot(e.currentTarget));
document.addEventListener('click', (e) => {
    if (e.target.closest('#terminalScreenshotBtn')) {
        window.takeScreenshot(e.target.closest('#terminalScreenshotBtn'));
    }
});

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
