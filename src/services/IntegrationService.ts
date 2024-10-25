import { ZoteroApiCreator, ZoteroApiPaper, ZoteroApiResponse } from '../classes/ZoteroTypes'

import { Data, Person } from 'csl-json';

const API_DOMAIN = process.env.API_ROOT;

export async function getRequestToken() {
    let resp;
    try {
        resp = await fetch(API_DOMAIN + "/zotero/request_token");
    }
    catch (ex) {
        alert("Error connecting to consumer API")
        return;
    }
    if (!resp.ok) {
        alert("Error code from OAuth consumer API- " + resp.statusText);
        return;
    }
    let token_data = await resp.text();
    const urlParams = new URLSearchParams(token_data);

    let oauth_token = urlParams.get("oauth_token");
    let oauth_token_secret = urlParams.get("oauth_token_secret");
    sessionStorage.setItem("zotero_request_secret", oauth_token_secret);
    let callback_url = window.location.origin;
    window.open(
        `https://www.zotero.org/oauth/authorize?oauth_token=${oauth_token}&oauth_callback=${callback_url}`,
         '_blank'
    ).focus();
    
}

export async function getAllPapersInZotero(): Promise<Data[]> {
    const USER_ID = localStorage.getItem("zotero_user_id");
    let resp: Response;
    try {
        // resp = await fetch(`${API_DOMAIN}/zotero/proxy/users/${USER_ID}/items`, {
        //     headers: {
        //         "OAuth-Token": localStorage.getItem("zotero_oauth_token"),
        //         "OAuth-Secret": localStorage.getItem("zotero_oauth_secret"),
        //     }});
        resp = await fetch(`https://api.zotero.org/users/${USER_ID}/items`, {
            headers: {
                "Zotero-API-Key": localStorage.getItem("zotero_api_key"),
            }});
            
            
            // ?key=${localStorage.getItem("zotero_oauth_secret")}`)
    } catch (ex) {
        alert("Error connecting to API");
        return;
    }
    if (!resp.ok) {
        alert("Error code from OAuth consumer API- " + resp.statusText);
        return;
    }
    let results = await resp.json() as ZoteroApiResponse[];
    let papers = results.map(result => result.data)
    console.table(papers)

    return papers.map(paper => zoteroPaperToCSL(paper))
}

function zoteroPaperToCSL(input: ZoteroApiPaper): Data {

    function convertPerson(creator: ZoteroApiCreator): Person {
        return {given: creator.firstName, family: creator.lastName}
    }
    const TYPE_MAP = {
        "journalArticle": "article-journal",
    }
    let output: Data =  {
        DOI :input.DOI,
        title: input.title,
        author: input.creators.map(convertPerson),
        type: TYPE_MAP[input.itemType],
        id: input.key,
        URL: input.url,

    }

    return output;
}