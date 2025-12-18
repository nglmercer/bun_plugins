import { 
    describe as _describe, 
    it as _it, 
    test as _test, 
    expect as _expect,
    beforeAll as _beforeAll,
    afterAll as _afterAll,
    beforeEach as _beforeEach,
    afterEach as _afterEach
} from "bun:test";

declare global {
    // Make test functions available globally for types (runtime still requires import or preload)
    var describe: typeof _describe;
    var it: typeof _it;
    var test: typeof _test;
    var expect: typeof _expect;
    var beforeAll: typeof _beforeAll;
    var afterAll: typeof _afterAll;
    var beforeEach: typeof _beforeEach;
    var afterEach: typeof _afterEach;
}

export {};
