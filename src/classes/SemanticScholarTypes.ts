export type Paper = {
    title?: string;
    citations?: Paper[];
    externalIds?: { DBLP?: string, MAG?: string, DOI?: string};
    paperId: string;
    references?: Paper[];

    /**
     * @deprecated This field should not be set, use externalIds.DOI instead.
     * Included because of the Semantic Scholar API's inconsistencies.
     */
    doi?: string;
}