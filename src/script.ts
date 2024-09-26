import { DataSet, Network, Options as NetworkOptions } from "vis-network/standalone";


import { Counter } from './Counter';
import { TupleSet } from "./TupleSet";
import { WorkerMessage, WorkerMessageType } from "./classes/WorkerMessage";
import { Paper } from "./classes/SemanticScholarTypes";

import { getRequestToken, zoteroLoadTest } from "./services/IntegrationService"

import * as astrocite from 'astrocite';

const TOGGLE_CONTROLS_BUTTON = document.getElementById("toggle-button")
TOGGLE_CONTROLS_BUTTON.onclick = () => 
    document.getElementById("controls").classList.toggle("collapsed");

const CITATION_WORKER = new Worker(new URL('./services/CitationWorker.ts', import.meta.url));
CITATION_WORKER.onmessage = workerCallback;

CITATION_WORKER.onerror = function(error: ErrorEvent) {
    // LOADING_ANIMATION.style.display = "none";
    document.getElementById("error-message").innerText = "An error which couldn't be handled happened";
    console.error(`Worker error: ${error.message}`);
}

// create an array with nodes
const nodes = new DataSet([
]);

// create an array with edges
const edges = new DataSet([
]);

// create a network
const container = document.getElementById('network');
const FILE_INPUT = document.getElementById('fileInput') as HTMLInputElement;

// provide the data in the vis format
var data = {
    nodes: nodes,
    edges: edges
};
const OPTIONS: NetworkOptions = {
    nodes: {
        shape: 'box',
        widthConstraint: {
            maximum: 100
        }
    },
    configure: {
        enabled: false,


        container: document.getElementById("vis-controls")
    },
    layout: {
        hierarchical: {
            enabled: true,
            sortMethod: "directed"
        }
    },
    groups: {
        "unknown-ref": { 
            color: { 
                background: 'lightgrey', 
                border: "#eeeeee",
                highlight: {
                    background: '#eee', 
                    border: "#eeeeee",
                }
            }
        }
    }
};

// initialize your network!
const network = new Network(container, data, OPTIONS);


const MIN_REFERENCES = 5

const REGISTERED_DOIS = new Set<string>();
const CITATION_EDGES = new TupleSet();
const KNOWN_CITATION_EDGES = new TupleSet();
const UNKNOWN_PAPER_NAMES = {};
const REFERENCE_COUNTER = new Counter();

// Some constant HTML elements that are there from the start
const PROGRESS_BAR = document.getElementsByTagName("progress")[0];
const SLIDER = document.getElementById("min-references") as HTMLInputElement;
const LOADING_ANIMATION = document.getElementById("loading-spinner");
const WARNINGS_DIALOG = document.getElementById("warnings-dialog") as HTMLDialogElement;
const IMPORT_DIALOG = document.getElementById("import-dialog") as HTMLDialogElement;

let currentMinRefs = Infinity;
let numIssues = 0;
// set up file upload
function fileSelectedCallback() {
    document.getElementById("error-message").innerText = "";
    const curFiles = FILE_INPUT.files;
    if (curFiles.length === 0) {
        alert("No files currently selected for upload")
        return;
    }

    PROGRESS_BAR.style.display = "inline-block";

    let reader = new FileReader();

    const fileReadCallback = async (e: ProgressEvent) => {
        if (e.type !== "load") {
            return;
        }
        try {
            let contents = reader.result as string;
            let fileExtension = file.name.split(".").slice(-1)[0];

            let parsedEntries;
            switch(fileExtension) {
                case("ris"):
                    parsedEntries = astrocite.ris.parse(contents);
                    break;
                case("bib"):
                    parsedEntries = astrocite.bibtex.parse(contents);
                    break;
                default:
                    throw new Error("Cannot identify file type");
            }
            
            processParsedEntries(parsedEntries);            
        }
        catch (ex) {
            document.getElementById("error-message").innerText = 
                        "An error the program couldn't handle occurred, sorry about that.";

            console.error(ex);
        }
    }

    reader.addEventListener("loadstart", fileReadCallback);
    reader.addEventListener("load", fileReadCallback);
    reader.addEventListener("loadend", fileReadCallback);
    reader.addEventListener("error", fileReadCallback);
    reader.addEventListener("abort", fileReadCallback);

    let file = curFiles[0]
    reader.readAsText(file);
}

FILE_INPUT.addEventListener("change", fileSelectedCallback)

// functions

console.debug("Data loaded, rendering known papers");

function processParsedEntries(parsedEntries: any) {
    PROGRESS_BAR.max = parsedEntries.length;

    // Register DOIs as soon as possible
    parsedEntries.map(entry => entry.DOI).filter(Boolean).forEach(
        entry => REGISTERED_DOIS.add(entry)
    );

    CITATION_WORKER.postMessage(parsedEntries);
}

function workerCallback(message: MessageEvent<WorkerMessage>){

    if (message.data.type === WorkerMessageType.Results) {
        PROGRESS_BAR.value = message.data.progress;
        renderResults(message.data.body);
    } else if (message.data.type === WorkerMessageType.Error) {
        document.getElementById("error-message").innerText = (message.data.body);
        console.error(message.data.body);
    } else if (message.data.type === WorkerMessageType.Warning) {
        numIssues++;
        Array.from(
            document.getElementsByClassName("warning-number") as HTMLCollectionOf<HTMLSpanElement>
        ).forEach(span => span.innerText = numIssues.toString() );
        let warningElement = document.createElement("li");
        warningElement.innerText = message.data.body;
        document.getElementById("warning-list").appendChild(warningElement);
    }
}

function renderResults(loadedPaperInfo: Array<Paper>) {
    for (let paperInfo of loadedPaperInfo) {

        REGISTERED_DOIS.add(paperInfo.externalIds.DOI);

        // Add references
        let papers_this_references = paperInfo["references"];
        for (let referenced_paper of papers_this_references) {
            if (!referenced_paper.externalIds?.DOI ) {
                continue;
            }
            if (REGISTERED_DOIS.has(referenced_paper.externalIds.DOI)) {
                KNOWN_CITATION_EDGES.add([paperInfo.externalIds?.DOI, referenced_paper.externalIds.DOI])
            } else {
                CITATION_EDGES.add([paperInfo.externalIds?.DOI, referenced_paper.externalIds.DOI])
            }


            if (!REGISTERED_DOIS.has(referenced_paper.externalIds.DOI)) {
                UNKNOWN_PAPER_NAMES[referenced_paper.externalIds.DOI] = referenced_paper.title;
            }
        }

        // Add citations
        let papersWhichCiteThis = paperInfo["citations"];
        if (papersWhichCiteThis) {
            for (let citing_paper of papersWhichCiteThis) {
                if (!citing_paper.externalIds?.DOI) {
                    continue;
                }

                if (REGISTERED_DOIS.has(citing_paper.externalIds.DOI)) {
                    KNOWN_CITATION_EDGES.add([citing_paper.externalIds.DOI, paperInfo.externalIds.DOI])
                } else {
                    CITATION_EDGES.add([citing_paper.externalIds.DOI, paperInfo.externalIds.DOI])
                }

                if (!REGISTERED_DOIS.has(citing_paper.externalIds.DOI)) {
                    UNKNOWN_PAPER_NAMES[citing_paper.externalIds.DOI] = citing_paper.title
                }
            }
        }

        // Add all connected papers to reference counter
        let new_dois = new Set(
            papers_this_references.concat(papersWhichCiteThis || [])
                .filter(ref => ref.externalIds?.DOI)
                .map(ref => ref.externalIds.DOI)
        );
        REFERENCE_COUNTER.update(new_dois)

        try {
            nodes.add({
                id: paperInfo.externalIds.DOI,
                label: paperInfo.title
            });
        }
        catch (ex) {
            console.error(ex);
        }

    }
    
    createNodesAndEdges(true);
    renderEdgesBetweenKnownNodes();
    network.fit();

    updateMinReferencesSlider();
}

function createNodesAndEdges(rerender:boolean) {
    let newMinRefs: number = Number.parseInt(SLIDER.value) || MIN_REFERENCES;
    let shared_refs: Set<string>;
    let increase = (newMinRefs > currentMinRefs) ;
    if (rerender) {
        shared_refs = new Set(Object.keys(REFERENCE_COUNTER.getResultsWithMin(newMinRefs)));
    } else {
        shared_refs = new Set(Object.keys(REFERENCE_COUNTER.getResultsInRange(
            Math.min(newMinRefs, currentMinRefs),
            Math.max(newMinRefs, currentMinRefs),
        )));
    }

    // set.difference is not yet available on most browsers so i have to delete one by one
    //TODO: do we need this? is this in the right place?
    for (let doi of REGISTERED_DOIS) {
        shared_refs.delete(doi);
    }

    for (let doi of shared_refs) {
        try {
            if (increase) {
                nodes.remove({
                    id: doi,
                    label: UNKNOWN_PAPER_NAMES[doi], group: "unknown-ref"
                });
            } else {
                nodes.add({
                    id: doi,
                    label: UNKNOWN_PAPER_NAMES[doi], group: "unknown-ref"
                });
            }
        }
        catch (ex) {
            console.error(ex);
        }
    }

    // TODO: currently doing this each time, inefficient
    let filtered_edges = Array.from(CITATION_EDGES).filter(edge => shared_refs.has(edge[0]) || shared_refs.has(edge[1])
    );


    //TODO: why are we removing things here? misleading and confusing function name, needs refactoring.
    for (let tuple of filtered_edges) {
        const edgeData = {
            from: tuple[0],
            to: tuple[1]
        };
        
        if (increase) {
            edges.remove([edgeData]);
        } else {
            edges.add([edgeData]);
        }
    }
    
}

function renderEdgesBetweenKnownNodes() {

    let plop = Array.from(KNOWN_CITATION_EDGES);

    for (let tuple of plop) {
        const edgeData = {
            from: tuple[0],
            to: tuple[1]
        };
        
        edges.add([edgeData]);
    }
    
}

function updateMinReferencesSlider(): void {
    const MAX_ON_SCREEN = 50;
    
    SLIDER.disabled = false;
    let histogram = REFERENCE_COUNTER.getHistogram();
    let max = histogram.length - 1;
    SLIDER.max = max.toString();

    let cumulativeCount = 0;
    for (let i = max; i > 0; i--) {
        cumulativeCount += histogram[i];
        if (cumulativeCount > MAX_ON_SCREEN) {
            SLIDER.min = (i+1).toString();
            break;
        }
    }
}

function minReferencesChange(ev: Event) {
    SLIDER.readOnly = true;
    createNodesAndEdges(false);

    currentMinRefs = Number.parseInt((ev.target as HTMLInputElement).value);
    SLIDER.readOnly = false;
}

SLIDER.onchange = minReferencesChange;

document.getElementById("warning-btn").onclick = () => {
    WARNINGS_DIALOG.show();
};

document.getElementById("close-warnings-btn").onclick = () => {
    WARNINGS_DIALOG.close();
};

document.getElementById("import-btn").onclick = () => {
    IMPORT_DIALOG.show();
}

document.getElementById("test").onclick = function(){
    getRequestToken();
}

document.getElementById("load_zotero").onclick = async function(){
    processParsedEntries(await zoteroLoadTest());
}

if (localStorage.getItem("zotero_api_key")) {
    (document.getElementById("load_zotero") as HTMLButtonElement).disabled = false;
} else {
    (document.getElementById("load_zotero") as HTMLButtonElement).disabled = true;
}

