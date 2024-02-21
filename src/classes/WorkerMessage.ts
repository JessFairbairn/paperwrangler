export type WorkerMessage = {
    type: WorkerMessageType;
    body: Array<any> | String;
}

export enum WorkerMessageType {
    Results = "results",
    Error = "error"
}