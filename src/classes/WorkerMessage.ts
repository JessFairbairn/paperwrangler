import { Paper } from "../classes/SemanticScholarTypes"

export type WorkerMessage = {
    type: WorkerMessageType.Results;
    body: Array<Paper>;
    progress: number;
} | {
    type: WorkerMessageType.Error|WorkerMessageType.Warning;
    body: string;
    progress: number;
}

export enum WorkerMessageType {
    Results = "results",
    Error = "error",
    Warning = "warning"
}