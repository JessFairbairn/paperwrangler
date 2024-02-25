import { Paper } from "../classes/SemanticScholarTypes"

export type WorkerMessage = {
    type: WorkerMessageType.Results;
    body: Array<Paper>;
} | {
    type: WorkerMessageType.Error;
    body: string;
}

export enum WorkerMessageType {
    Results = "results",
    Error = "error"
}