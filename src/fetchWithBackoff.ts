import { WorkerMessage } from "./classes/WorkerMessage";

export async function fetchWithBackoff(resource: string | URL | Request, options: RequestInit = {}, fuse = 0) {
    try {
        return await fetch(resource, options);
    }
    catch (ex) {
        if (ex instanceof TypeError && ex.message.includes("NetworkError")) {
            // assume it's a 429
            postMessage({
                type: "error",
                body: "You appear to be rate limited, loading will likely be slow."
            } as WorkerMessage);
            await delayPromise((fuse + 1) * 5000);
            return await fetchWithBackoff(resource, options, fuse + 1);
        } else {
            throw new Error("An error occurred while loading paper", { cause: ex });
        }
    }
}
function delayPromise(millisec): Promise<any> {
    return new Promise(resolve => {
        setTimeout(() => resolve(''), millisec);
    });
}
