// import "./node_modules/@citation-js/core/lib-mjs/index.js"
import {DataSet, Network} from "./node_modules/vis-network/standalone/esm/vis-network.js"

// import {parseBibFile} from "./node_modules/bibtex/index.js";

import {Counter} from './Counter.js'
import {TupleSet} from "./TupleSet.js";
import {getPaperInfoFromDoi} from "./services/CitationService.js"

const Cite  = require(
    ["citation-js"]
);


// create an array with nodes
const nodes = new DataSet([
]);

// create an array with edges
const edges = new DataSet([
]);

// create a network
const container = document.getElementById('network');
const fileInput = document.getElementById('fileInput');

// provide the data in the vis format
var data = {
    nodes: nodes,
    edges: edges
};
var options = {
    configure:{
        enabled:true,
        
        container: document.getElementById("controls")
    },
    layout: {
        hierarchical: {
            enabled: true,
            sortMethod: "directed"
        }
    },
    groups: {
        "unknown-ref": {color:{background:'lightgrey', border: "#eeeeee"}}
      }
};

// initialize your network!
const network = new Network(container, data, options);


const MIN_REFERENCES = 2

const REGISTERED_DOIS = new Set();
const CITATION_EDGES = new TupleSet();
const UNKOWN_PAPER_NAMES = {};
const reference_counter = new Counter();

// set up file upload
const fileUploaded = function () {
    const curFiles = fileInput.files;
    if (curFiles.length === 0) {
        alert("No files currently selected for upload")
        return;
    }
    let reader = new FileReader();
    
    const handleEvent = async e => {
        if (e.type !== "load"){
            return;
        }
        let contents = reader.result;
        let parsedEntries = Cite.input(contents);

        for (let entry of parsedEntries){
            let paperInfo;
            if (entry.DOI) {
                paperInfo = await getPaperInfoFromDoi(entry.DOI);
            }
            else {
                // TODO: handle papers with no doi
                console.warn(`Paper "${entry.title}" missing DOI`)
                continue;
            }
            let papers_this_references = paperInfo["references"];
            for (let referenced_paper of papers_this_references) {
                CITATION_EDGES.add([entry.DOI, referenced_paper["doi"]])
            

                if (!REGISTERED_DOIS.has(referenced_paper["doi"])) {
                    UNKOWN_PAPER_NAMES[referenced_paper["doi"]] = referenced_paper["title"]
                }
            }

            let papers_which_cite_this = paperInfo["citations"]

            for (let citing_paper of papers_which_cite_this) {
                CITATION_EDGES.add([citing_paper["doi"], entry.DOI])

                if (!REGISTERED_DOIS.has(citing_paper["doi"])) {
                    UNKOWN_PAPER_NAMES[citing_paper["doi"]] = citing_paper["title"]
                }
            }

            let new_dois = new Set((papers_this_references.concat(papers_which_cite_this).map(ref => ref["doi"])))
            reference_counter.update(new_dois)

            try{
                nodes.add({
                    id: entry.DOI,
                    label: entry.title
                });
            }
            catch(ex) {
                console.error(ex);
            }

            
        }

        // TODO: only add papers with min numbers of edges
        let shared_refs = new Set(Object.keys(reference_counter.getResultsWithMin(MIN_REFERENCES)))
        
        // set.difference is not yet available on most browsers so i have to delete one by one
        for (let doi of REGISTERED_DOIS){
            shared_refs.delete(doi);
        }
        
        for (let doi of shared_refs) {
            nodes.add({id:doi, 
                label:UNKOWN_PAPER_NAMES[doi], group:"unknown-ref"})
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

    reader.addEventListener("loadstart", handleEvent);
    reader.addEventListener("load", handleEvent);
    reader.addEventListener("loadend", handleEvent);
    reader.addEventListener("error", handleEvent);
    reader.addEventListener("abort", handleEvent);

    for (const file of curFiles) {
        reader.readAsText(file);
    }
}

fileInput.addEventListener("change", fileUploaded)

