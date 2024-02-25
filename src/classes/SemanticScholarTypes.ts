export type Paper = {
    title?: string;
    citations?: Paper[];
    externalIds?: { DBLP?: string, MAG?: string, DOI?: string};
    paperId: string;
    references?: Paper[];
}