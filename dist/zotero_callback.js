const API_DOMAIN = "http://127.0.0.1:5000"; // TODO: import this domain from the integration service

const urlParams = new URLSearchParams(window.location.search);
const oauth_token = urlParams.get('oauth_token');
const oauth_verifier = urlParams.get('oauth_verifier');



async function call(){
    const oauth_request_secret = sessionStorage.getItem("zotero_request_secret");
    if (!oauth_request_secret) {
        alert("No OAuth request secret has been set on this machine, TBPH I don't know how you got to this page.");
        return;
    }
    // call step three on the API- requires token key, token secret and verifier
    let resp;
    try {
        resp = await fetch(`${API_DOMAIN}/zotero/authorise_token?token_key=${oauth_token}&token_secret=${oauth_request_secret}&verifier=${oauth_verifier}`);
    }
    catch (ex) {
        alert("Error connecting to consumer API")
        return;
    }
    if (!resp.ok) {
        alert("Error code from OAuth consumer API- " + resp.statusText);
        return;
    }

    let token_data = await resp.json();

    sessionStorage.removeItem("zotero_request_secret");
    localStorage.setItem("zotero_api_key", token_data.oauth_token);
    localStorage.setItem("zotero_user_id", token_data.userID);
    localStorage.setItem("zotero_username", token_data.username);

    window.location.replace('index.html')
}

call();

// export {}