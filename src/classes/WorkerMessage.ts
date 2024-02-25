import { Paper } from "../classes/SemanticScholarTypes"

export type WorkerMessage = {
    type: WorkerMessageType.Results;
    body: Array<Paper>;
    progress: number;
} | {
    type: WorkerMessageType.Error;
    body: string;
    progress: number;
}

export enum WorkerMessageType {
    Results = "results",
    Error = "error"
}