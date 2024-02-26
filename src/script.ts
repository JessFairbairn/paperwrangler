import { DataSet, Network } from "vis-network/standalone"


import { Counter } from './Counter'
import { TupleSet } from "./TupleSet";
import { WorkerMessage, WorkerMessageType } from "./classes/WorkerMessage";
import { Paper } from "./classes/SemanticScholarTypes";

import * as astrocite from 'astrocite';

const TOGGLE_CONTROLS_BUTTON = document.getElementById("toggle-button")
TOGGLE_CONTROLS_BUTTON.onclick = () => 
    document.getElementById("controls").classList.toggle("collapsed");

const CITATION_WORKER = new Worker(new URL('./services/CitationWorker.ts', import.meta.url));
CITATION_WORKER.onmessage = workerCallback;

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
const OPTIONS = {
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
        "unknown-ref": { color: { background: 'lightgrey', border: "#eeeeee" } }
    }
};

// initialize your network!
const network = new Network(container, data, OPTIONS);


const MIN_REFERENCES = 5

const REGISTERED_DOIS = new Set<string>();
const CITATION_EDGES = new TupleSet();
const UNKNOWN_PAPER_NAMES = {};
const REFERENCE_COUNTER = new Counter();

const PROGRESS_BAR = document.getElementsByTagName("progress")[0];
const SLIDER = document.getElementById("min-references") as HTMLInputElement;
const LOADING_ANIMATION = document.getElementById("loading-spinner");

let currentMinRefs = Infinity;

// set up file upload
function fileUploaded() {
    const curFiles = FILE_INPUT.files;
    if (curFiles.length === 0) {
        alert("No files currently selected for upload")
        return;
    }

    LOADING_ANIMATION.style.display = "inline-block";
    PROGRESS_BAR.style.display = "inline-block";

    let reader = new FileReader();

    const handleEvent = async (e: ProgressEvent) => {
        if (e.type !== "load") {
            return;
        }
        try {
            let contents = reader.result as string; //not great
            let parsedEntries = astrocite.bibtex.parse(contents);
            PROGRESS_BAR.max = parsedEntries.length;
            PROGRESS_BAR.value = 0;
            try {
                CITATION_WORKER.postMessage(parsedEntries);
            }
            catch (ex) {
                if (ex instanceof TypeError && ex.message.includes("NetworkError")) {
                    document.getElementById("error-message").innerText = 
                        "A network error occurred while loading citation data.";
                } else {
                    document.getElementById("error-message").innerText = 
                        "An error the program couldn't handle occurred, sorry about that.";
                }
                console.error(ex);
                LOADING_ANIMATION.style.display = "none";
            }

            
        }
        catch (ex) {
            document.getElementById("error-message").innerText = 
                        "An error the program couldn't handle occurred, sorry about that.";

            console.error(ex);
        }
    }

    reader.addEventListener("loadstart", handleEvent);
    reader.addEventListener("load", handleEvent);
    reader.addEventListener("loadend", handleEvent);
    reader.addEventListener("error", handleEvent);
    reader.addEventListener("abort", handleEvent);

    for (const file of curFiles) {
        reader.readAsText(file);
    }
}

FILE_INPUT.addEventListener("change", fileUploaded)

// functions

console.debug("Data loaded, rendering known papers");

function workerCallback(message: MessageEvent<WorkerMessage>){

    if (message.data.type === WorkerMessageType.Results) {
        PROGRESS_BAR.value = message.data.progress;
        renderResults(message.data.body);
    } else if (message.data.type === WorkerMessageType.Error) {
        console.error(message.data.body);
    }
}

function renderResults(loadedPaperInfo: Array<Paper>) {
    for (let paperInfo of loadedPaperInfo) {

        // Add references
        let papers_this_references = paperInfo["references"];
        for (let referenced_paper of papers_this_references) {
            if (!referenced_paper.externalIds?.DOI ) {
                continue;
            }
            CITATION_EDGES.add([paperInfo.externalIds?.DOI, referenced_paper.externalIds.DOI])


            if (!REGISTERED_DOIS.has(referenced_paper.externalIds.DOI)) {
                UNKNOWN_PAPER_NAMES[referenced_paper.externalIds.DOI] = referenced_paper.title;
            }
        }

        // Add citations
        let papers_which_cite_this = paperInfo["citations"];
        for (let citing_paper of papers_which_cite_this) {
            if (!citing_paper.externalIds?.DOI) {
                continue;
            }
            CITATION_EDGES.add([citing_paper.externalIds.DOI, paperInfo.externalIds.DOI])

            if (!REGISTERED_DOIS.has(citing_paper.externalIds.DOI)) {
                UNKNOWN_PAPER_NAMES[citing_paper.externalIds.DOI] = citing_paper.title
            }
        }

        // Add all connected papers to reference counter
        let new_dois = new Set(
            papers_this_references.concat(papers_which_cite_this)
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
    console.log("Rendering novel papers");

    createNodesAndEdges(true);
    network.fit();

    updateMinReferencesSlider();
}

function createNodesAndEdges(rerender:boolean) {
    let min_refs: number = Number.parseInt(SLIDER.value) || MIN_REFERENCES;
    let shared_refs: Set<string>;
    if (rerender) {
        shared_refs = new Set(Object.keys(REFERENCE_COUNTER.getResultsWithMin(min_refs)));
    } else {
        shared_refs = new Set(Object.keys(REFERENCE_COUNTER.getResultsInRange(min_refs, currentMinRefs)));
    }

    // set.difference is not yet available on most browsers so i have to delete one by one
    for (let doi of REGISTERED_DOIS) {
        shared_refs.delete(doi);
    }

    for (let doi of shared_refs) {
        try {
            nodes.add({
                id: doi,
                label: UNKNOWN_PAPER_NAMES[doi], group: "unknown-ref"
            });
        }
        catch (ex) {
            console.error(ex);
        }
    }

    let filtered_edges = Array.from(CITATION_EDGES).filter(edge => shared_refs.has(edge[0]) || shared_refs.has(edge[1])
    );

    for (let tuple of filtered_edges) {
        const edgeData = {
            from: tuple[0],
            to: tuple[1]
        };
        // console.debug(edgeData)
        edges.add([edgeData]);
    }
}

function updateMinReferencesSlider(): void {
    const MAX_ON_SCREEN = 1000;
    
    SLIDER.disabled = false;
    let histogram = REFERENCE_COUNTER.getHistogram();
    let max = histogram.length - 1;
    SLIDER.max = max.toString();

    let cumulativeCount = 0;
    for (let i = max; i > 0; i--) {
        cumulativeCount += histogram[i];
        if (cumulativeCount > MAX_ON_SCREEN) {
            SLIDER.min = (i+1).toString();
        }
    }
    SLIDER.min = "1";
}

function minReferencesChange(ev: Event) {
    SLIDER.readOnly = true;
    createNodesAndEdges();

    currentMinRefs = Number.parseInt((ev.target as HTMLInputElement).value);
    SLIDER.readOnly = false;
}

SLIDER.onchange = minReferencesChange;

CITATION_WORKER.onerror = function(error) {
    LOADING_ANIMATION.style.display = "none";
    document.getElementById("worker-errors").innerText = "An error which couldn't be handled happened";
    console.log(`Worker error: ${error.message}`);
    throw error;
}