async function getPaperInfoFromDoi(doi) {
    let doiCode;
    if (doi.startsWith(10)) {
        doiCode = doi; 
    } else {
        const pattern = /(10[.][0-9]{4,}(?:[.][0-9]+)*\/(?:(?!["&\'<>])\S)+)/i
        let result = pattern.exec(doi)
        if (result[0]) {
            doiCode = result[0];
        }
    }
    let resp = await fetch(`https://api.semanticscholar.org/v1/paper/${doiCode}`)

    let json = resp.json()
    return json
}

export {getPaperInfoFromDoi}