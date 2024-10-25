export interface ZoteroApiResponse {
    key: string;
    version: number;
    library: any;
    links: any;
    meta: any;
    data: ZoteroApiPaper;
}

export interface ZoteroApiPaper {
    key: string;
    version: number;
    itemType: string;
    title: string;
    creators: ZoteroApiCreator[];
    abstractNote: string;
    publicationTitle: string;
    DOI: string;
    url?: string;
}

export interface ZoteroApiCreator {
    creatorType: string;
    firstName: string;
    lastName: string;
}