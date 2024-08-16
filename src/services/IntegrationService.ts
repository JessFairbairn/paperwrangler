const API_DOMAIN = "http://127.0.0.1:5000";

export async function getRequestToken() {
    let resp;
    try {
        resp = await fetch(API_DOMAIN + "/zotero");
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
    const urlParams = new URLSearchParams(token_data)
    let parts = token_data.split("&");

    let oauth_token = urlParams.get("oauth_token");
    let oauth_token_secret = urlParams.get("oauth_token_secret");
    // sessionStorage.setItem("zotero_request_token", oauth_token);
    sessionStorage.setItem("zotero_request_secret", oauth_token_secret);
    let callback_url = window.location.origin;
    window.open(
        `https://www.zotero.org/oauth/authorize?oauth_token=${oauth_token}&oauth_callback=${callback_url}`,
         '_blank'
    ).focus();
    
}

// function generateOAuthHeader(auth, method, port, hostname, path, params){

//     let signatureParams = [];
    
//     for (let key in params){
//         signatureParams.push((`${key}=${params[key]}`));
//     }
    
//     for (let key in auth){
//         signatureParams.push((`${key}=${auth[key]}`));
//     }
    
//     signatureParams = signatureParams.sort();
    
//     let parameterString = signatureParams.join("&");
    
//     console.log("parameterString", parameterString);
    
//     let baseUrl = encodeURIComponent(`${port === 80 ? "http://" : "https://"}${hostname}${path}`);
    
//     console.log("baseUrl", baseUrl);
    
//     let baseString = `${method}&${baseUrl}&${encodeURIComponent(parameterString)}`;
    
//     console.log("baseString", baseString);
    
//     let encodeKey = `${consumerSecret}&${tokenSecret}`;
    
//     console.log("encodeKey", encodeKey);
    
//     let signature = crypto.createHmac('sha1', encodeKey).update(baseString).digest('base64');
    
//     console.log("signature", signature);
    
//     auth.oauth_signature = (signature);
    
//     return `OAuth `+objectToQuotedParams(auth, ",");
// }

export async function foo() {
    // let foo = new OAuth({
    //     consumer: {

    //     }
    // })
    const CONSUMER_KEY = "c09173f954b92548b378";
    // crypto.subtle.
    debugger
    let params = {
        "oauth_consumer_key": CONSUMER_KEY,
        "oauth_signature":"TO DO",
        "oauth_signature_method": 'HMAC-SHA1',
        "oauth_nonce": crypto.randomUUID(),
        "oauth_timestamp":"to do",
    }
    let bar = new URLSearchParams({blah: 'lalala', rawr: 'arwrar'});
    let resp = await fetch("https://www.zotero.org/oauth/access?" + bar.toString());
    alert(await resp.text())

    //oauth_consumer_key%26oauth_signature%26oauth_signature_method%26oauth_nonce%26oauth_timestamp
    // https://www.zotero.org/oauth/access?oauth_token=

    // https://furby.industries/projects/paper-wrangler/?oauth_token=ba30d183dcf059337453&oauth_verifier=4b57b056c9508ac9de26
}