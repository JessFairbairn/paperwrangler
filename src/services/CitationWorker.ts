import { Data } from 'csl-json';

import { partitionArray } from '../PartitionArray';
import { WorkerMessage } from "../classes/WorkerMessage"
import { Paper } from "../classes/SemanticScholarTypes"

async function processArray(paperList: Data[]): Promise<void> {

    let [codesForLookup, remainingPapers] = partitionPapers(paperList);
    let citationCounts = await bulkBareInfo(codesForLookup);
    let [paperInfos, tooManyCitations] = await partitionArray(citationCounts, (paperInfo => paperInfo && paperInfo.citationCount < 1000))
    //TODO: do something with tooManyCitations
    let resp = await bulkRetrival(paperInfos.map(paper => paper.paperId));
    postMessage({type:"results", body: resp} as WorkerMessage);

    //Now get the rest:
    for (let entry of remainingPapers) {
        try {
            let paperInfo = await findPaper(entry);

            if (!paperInfo) {
                console.warn(`Could not identify info for "${entry.title}"`)
                continue;
            }
            postMessage({type:"results", body: [paperInfo]} as WorkerMessage);
        }        
        catch (ex) {
            if (ex instanceof TypeError && ex.message.includes("NetworkError")) {
                // assume it's a 429
                // TODO: pass some sort of error message to the main script instead of 
                //  writing to DOM here.
                postMessage({
                    type: "error",
                    body: "You appear to be rate limited, some papers may be missing."
                } as WorkerMessage);
            } else {
                throw new Error("An error occurred while loading paper", {cause:ex});
            }
        }
    }
    
}

async function getPaperInfoFromDoi(doi) {
    let doiCode;
    if (doi.startsWith(10)) {
        doiCode = doi; 
    } else {
        const pattern = /(10[.][0-9]{4,}(?:[.][0-9]+)*\/(?:(?!["&\'<>])\S)+)/i
        let result = pattern.exec(doi)
        if (!result) {
            //probably not a DOI but we'll search the API anyway
            doiCode = doi;
        }
        else {
            doiCode = result[0];
        }
    }
    let resp = await fetch(`https://api.semanticscholar.org/v1/paper/${doiCode}?fields=externalIds`);
    if (resp.status >= 400) {
        //TODO: handle better
        return null;
    }
    let json = await resp.json();
    return json;

    
}


async function findPaper(paperInfo): Promise<Paper> {
    let url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${paperInfo.title}&fields=title,authors,externalIds`
    
    let resp = await fetch(url);
    const responseJson = await resp.json();
    if (responseJson.total === 0) {
        // No matches found
        return null;
    }
    const candidates = responseJson.data;
    for (let match of candidates) {
        let authorName = paperInfo.author[0].given + " " + paperInfo.author[0].family;
        if (match.title.toLowerCase() === paperInfo.title.toLowerCase() && match.authors.map(author => author.name).includes(authorName)) {
            return await getPaperInfoFromDoi(match.paperId)
        }
    }
    // None of the matches suggested by the API were close enough
    return null;
}


function partitionPapers(paperList: Data[]): [string[], Data[]] {
    return paperList.reduce(
        ([pass, fail], elem) => {
            let code = findIdFromPaper(elem);
            
            if (code) {
                debugger
                return [[...pass, code], fail]; // just return the code
            }
            else {
                debugger
                return [pass, [...fail, elem]]; // return the whole object
            }
        }, 
        [[] as string[], [] as Data[]]
    );
}

function findIdFromPaper(paperInfo: Data): string | null {
    if (paperInfo.DOI && paperInfo.DOI.startsWith("10")) {
        return "DOI:" + paperInfo.DOI; 
    }

    const DOI_PATTERN = /(10[.][0-9]{4,}(?:[.][0-9]+)*\/(?:(?!["&\'<>])\S)+)/i
    let result = DOI_PATTERN.exec(paperInfo.URL)
    if (result) {
        return "DOI:" + result[0];
    }
    
    //extract code from arxiv urls
    const ARXIV_URL_PATTERN = /(?:(?:https?:\/\/)?arxiv\.org\/abs\/)(\S+)/i;
    let arxiv_result = ARXIV_URL_PATTERN.exec(paperInfo.URL)
    if (arxiv_result) {
        return "ARXIV:" + arxiv_result[0];
    }

    // Check if it's in one of the websites semantic scholar supports
    if (paperInfo.URL) {
        debugger;
        const SEMANTIC_SCHOLAR_KNOWS_URLS = [
            "semanticscholar.org",
            "arxiv.org",
            "aclweb.org",
            "acm.org",
            "biorxiv.org"
        ];
        let paperUrl = new URL(paperInfo.URL);
        let domainName = paperUrl.hostname.split(".").slice(-2).join(".");
        if (SEMANTIC_SCHOLAR_KNOWS_URLS.includes(domainName)) {
            return "URL:" + paperInfo.URL;
        }
    }
    
    // check for Google Scholar format arxiv referencing
    if (paperInfo['container-title'] && paperInfo['container-title'].startsWith("arXiv preprint arXiv:")) {
        return "ARXIV:" + paperInfo['container-title'].split(":")[1]
    }

    return null;
}

async function bulkRetrival(paperIds: string[]): Promise<Paper[]> {
    let resp = await fetch(
        "https://api.semanticscholar.org/graph/v1/paper/batch?fields=" +
        "citations.title,citations.externalIds,references.title,references.externalIds,title,externalIds", 
        {
        method: "POST",
        body: JSON.stringify({ids: paperIds})
    });

    return await resp.json();
}

async function bulkBareInfo(paperIds: string[]): Promise<any[]> {
    let resp = await fetch("https://api.semanticscholar.org/graph/v1/paper/batch?fields=citationCount,referenceCount", {
        method: "POST",
        body: JSON.stringify({ids: paperIds})
    });

    return await resp.json();
}

onmessage = async function(ev) {
    await processArray(ev.data)
}