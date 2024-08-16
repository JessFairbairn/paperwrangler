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

export async function zoteroLoadTest() {
    alert("NOT IMPLEMENTED")
}