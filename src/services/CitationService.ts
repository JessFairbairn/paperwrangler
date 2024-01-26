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
    let resp = await fetch(`https://api.semanticscholar.org/v1/paper/${doiCode}`);
    if (resp.status >= 400) {
        //TODO: handle better
        return null;
    }
    let json = await resp.json();
    return json;

    
}


async function findPaper(paperInfo) {
    let url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${paperInfo.title}&fields=title,authors`
    
    let resp = await fetch(url);
    const candidates = (await resp.json()).data;
    for (let match of candidates) {
        let authorName = paperInfo.author[0].given + " " + paperInfo.author[0].family;
        if (match.title.toLowerCase() === paperInfo.title.toLowerCase() && match.authors.map(author => author.name).includes(authorName)) {
            return await getPaperInfoFromDoi(match.paperId)
        }
    }

    return null;
}

export {findPaper, getPaperInfoFromDoi}