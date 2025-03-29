import {expect, test, jest} from '@jest/globals';

// import { fetchWithBackoff } from "../fetchWithBackoff"
import {getPaperInfoFromDoi} from "../services/CitationWorker";

global.fetchWithBackoff = jest.fn(x => new Promise(()=>{}));


describe("getPaperInfoFromDoi", () => {
    
    test("should call fetch", async () => {
        let result = await getPaperInfoFromDoi("test");

        expect(global.fetchWithBackoff.mock.calls).toBeCalled()
    });
});