import { DataSet, Network } from "vis-network/standalone"


import { Counter } from './Counter'
import { TupleSet } from "./TupleSet";
import { WorkerMessage, WorkerMessageType } from "./classes/WorkerMessage"

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
const UNKOWN_PAPER_NAMES = {};
const reference_counter = new Counter();

// set up file upload
const fileUploaded = function () {
    const curFiles = FILE_INPUT.files;
    if (curFiles.length === 0) {
        alert("No files currently selected for upload")
        return;
    }

    const LOADING_ANIMATION = document.getElementById("loading-spinner");
    LOADING_ANIMATION.style.display = "inline-block";

    let reader = new FileReader();

    const handleEvent = async (e: ProgressEvent) => {
        if (e.type !== "load") {
            return;
        }
        try {
            let contents = reader.result as string; //not great
            let parsedEntries = astrocite.bibtex.parse(contents);
            
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
        
        LOADING_ANIMATION.style.display = "none";
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
        renderResults(message.data.body as any[]);
    } else if (message.data.type === WorkerMessageType.Error) {
        console.error(message.data.body);
    }
}

function renderResults(loadedPaperInfo: any[]){
    for (let paperInfo of loadedPaperInfo) {

        let papers_this_references = paperInfo["references"];
        for (let referenced_paper of papers_this_references) {
            if (!referenced_paper.externalIds?.DOI ) {
                console.debug("Skipping paper without doi", referenced_paper);
                continue;
            }
            CITATION_EDGES.add([paperInfo["externalIds"]["DOI"], referenced_paper["externalIds"]["DOI"]])


            if (!REGISTERED_DOIS.has(referenced_paper["externalIds"]["DOI"])) {
                UNKOWN_PAPER_NAMES[["externalIds"]["DOI"]] = referenced_paper["title"]
            }
        }

        let papers_which_cite_this = paperInfo["citations"]

        for (let citing_paper of papers_which_cite_this) {
            if (!citing_paper.externalIds?.DOI) {
                continue;
            }
            CITATION_EDGES.add([citing_paper["externalIds"]["DOI"], paperInfo["externalIds"]["DOI"]])

            if (!REGISTERED_DOIS.has(citing_paper["externalIds"]["DOI"])) {
                UNKOWN_PAPER_NAMES[citing_paper["externalIds"]["DOI"]] = citing_paper["title"]
            }
        }

        let new_dois = new Set(
            papers_this_references.concat(papers_which_cite_this)
                .filter(ref => ref.externalIds?.DOI)
                .map(ref => ref["externalIds"]["DOI"])
        );
        reference_counter.update(new_dois)

        try {
            nodes.add({
                id: paperInfo["externalIds"]["DOI"],
                label: paperInfo.title
            });
        }
        catch (ex) {
            console.error(ex);
        }

    }
    console.debug("Rendering novel papers");
    // TODO: only add papers with min numbers of edges
    let shared_refs = new Set(Object.keys(reference_counter.getResultsWithMin(MIN_REFERENCES)))

    // set.difference is not yet available on most browsers so i have to delete one by one
    for (let doi of REGISTERED_DOIS) {
        shared_refs.delete(doi);
    }

    for (let doi of shared_refs) {
        try{
            nodes.add({
                id: doi,
                label: UNKOWN_PAPER_NAMES[doi], group: "unknown-ref"
            })
        }
        catch (ex) {
            console.error(ex);
        }
    }

    let filtered_edges = Array.from(CITATION_EDGES).filter(edge =>
        shared_refs.has(edge[0]) || shared_refs.has(edge[1])
    )

    for (let tuple of filtered_edges) {
        const edgeData = {
            from: tuple[0],
            to: tuple[1]
        };
        // console.debug(edgeData)
        edges.add([edgeData])
    }
}