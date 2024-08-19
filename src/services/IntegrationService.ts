const API_DOMAIN = "http://127.0.0.1:5000";

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

export async function zoteroLoadTest() {
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
    console.table(await resp.json())
}