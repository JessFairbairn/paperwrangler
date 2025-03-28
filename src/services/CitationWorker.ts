import { Data } from 'csl-json';

import { partitionArray } from '../PartitionArray';
import { WorkerMessage } from "../classes/WorkerMessage"
import { Paper } from "../classes/SemanticScholarTypes"
import { fetchWithBackoff } from '../fetchWithBackoff';
import { filterBySecondArray } from '../filterBySecondArray';

const DOI_BATCH_SIZE = 5;
let idsToLoads: string[] = [];

async function processArray(paperList: Data[]): Promise<void> {
    let numberReturned = 0;

    let paperCodes: string[] = paperList.map(paper => findIdFromPaper(paper));
    let [papersWithCode, papersWithoutCodes] = filterBySecondArray(paperList, paperCodes);
    paperCodes = paperCodes.filter(code => code);

    // let [codesForLookup, remainingPapers] = partitionPapers(paperList);
    let citationCounts = await bulkBareInfo(paperCodes);

    let [_, papersWithInvalidCodes] = filterBySecondArray(papersWithCode, citationCounts);
    papersWithInvalidCodes.forEach(paper =>{
        postWarning(`${paper.title} has an invalid DOI or URL, check input file`);
    });

    let [papersToGetCitationsFor, tooManyCitations] = partitionArray(
        citationCounts.filter(paperInfo => paperInfo), 
        (paperInfo => paperInfo && paperInfo.citationCount < 1000)
    );
    if (tooManyCitations.length) {
        postWarning(`${tooManyCitations.length} papers have more than 1000 citations, which will not be loaded`);
    }

    let resp = await bulkRetrival(papersToGetCitationsFor.map(paper => paper.paperId));
    postMessage({type:"results", body: resp, progress: papersToGetCitationsFor.length});

    let respWithoutCitations = await bulkRetrival(tooManyCitations.map(paper => paper.paperId), false);
    numberReturned = papersToGetCitationsFor.length + tooManyCitations.length;
    postMessage({type:"results", body: respWithoutCitations, progress: numberReturned});

    //Now get the rest:
    papersWithoutCodes.push(...papersWithInvalidCodes);
    for (let entry of papersWithoutCodes) {
        numberReturned++;
        try {
            let paperId = await findPaperId(entry);

            if (!paperId) {
                postWarning(`Could not identify info for "${entry.title}"`);
                continue;
            }
            idsToLoads.push(paperId);
            // postMessage({type:"results", body: [paperId], progress: numberReturned} as WorkerMessage);
        }        
        catch (ex) {
            // shouldn't be a 429
            postMessage({
                type: "error",
                body: "An unhandled error occurred",
                progress: numberReturned
            } as WorkerMessage);
        }

        if (idsToLoads.length % DOI_BATCH_SIZE === 0) {
            let results = await bulkRetrival(idsToLoads)
            postMessage({type:"results", body: results, progress: numberReturned} as WorkerMessage);
            idsToLoads = [];
        }
    }
    if (idsToLoads.length) {
        let results = await bulkRetrival(idsToLoads)
        postMessage({type:"results", body: results, progress: numberReturned} as WorkerMessage);
    }
}

export async function getPaperInfoFromDoi(doi): Promise<Paper> {
    // TODO: I think this function is out of date, and only ever receives Semantic
    //  scholar internal IDs
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
    let resp = await fetchWithBackoff(`https://api.semanticscholar.org/v1/paper/${doiCode}?fields=externalIds`);
    if (resp.status >= 400) {
        //TODO: handle better
        console.error(resp)
        return null;
    }
    let json = await resp.json() as Paper;
    if (json?.externalIds) {
        console.warn("Huzzah! They've fixed this bug.")
    } else {
        json.externalIds = {DOI: json.doi};
    }

    json.citations.forEach(citation => citation.externalIds = {DOI: citation.doi});
    json.references.forEach(reference => reference.externalIds = {DOI: reference.doi});
    return json;
}


async function findPaperId(paperInfo: Data): Promise<string> {
    let url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${paperInfo.title}&fields=title,authors,externalIds`
    
    let resp = await fetchWithBackoff(url);
    const responseJson = await resp.json();
    if (responseJson.total === 0) {
        // No matches found
        return null;
    }
    const candidates = responseJson.data;
    for (let match of candidates) {
        let authorName = paperInfo.author[0].given + " " + paperInfo.author[0].family;
        let authorName2 = paperInfo.author[0].given[0] + ". " + paperInfo.author[0].family;
        if (match.title.toLowerCase() === paperInfo.title.toLowerCase() && match.authors.some(author => [authorName,authorName2].includes(author.name))) {
            // return await getPaperInfoFromDoi(match.paperId);
            // idsToLoads.push(match.paperId);
            return match.paperId;
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
                return [[...pass, code], fail]; // just return the code
            }
            else {
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

async function bulkRetrival(paperIds: string[], includeCitations=true): Promise<Paper[]> {
    if (paperIds.length === 0) {
        return [];
    }

    let url = "https://api.semanticscholar.org/graph/v1/paper/batch?fields=" +
        "references.title,references.externalIds,title,externalIds";
    if (includeCitations) {
        url += ",citations.title,citations.externalIds"
    }
    let resp = await fetchWithBackoff(
        url, 
        {
        method: "POST",
        body: JSON.stringify({ids: paperIds})
    });

    return await resp.json();
}

async function bulkBareInfo(paperIds: string[]): Promise<any[]> {
    if (paperIds.length === 0) {
        return [];
    }
    let resp = await fetchWithBackoff("https://api.semanticscholar.org/graph/v1/paper/batch?fields=citationCount,referenceCount", {
        method: "POST",
        body: JSON.stringify({ids: paperIds})
    });

    return await resp.json();
}

onmessage = async function(ev) {
    await processArray(ev.data)
}

self.onunhandledrejection = function(error: PromiseRejectionEvent) {
    throw error.reason;
}

function postWarning(body: string) {
    postMessage({
        type:"warning", 
        body, 
    } as WorkerMessage);
}