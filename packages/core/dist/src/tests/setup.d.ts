export declare const mockRedis: {
    quit: jest.Mock<any, any, any>;
    set: jest.Mock<any, any, any>;
    get: jest.Mock<any, any, any>;
    del: jest.Mock<any, any, any>;
    exists: jest.Mock<any, any, any>;
    publish: jest.Mock<any, any, any>;
    subscribe: jest.Mock<any, any, any>;
    unsubscribe: jest.Mock<any, any, any>;
};
export declare const mockJob: {
    id: string;
    name: string;
    data: {};
    opts: {};
    progress: jest.Mock<any, any, any>;
    updateProgress: jest.Mock<any, any, any>;
    moveToCompleted: jest.Mock<any, any, any>;
    moveToFailed: jest.Mock<any, any, any>;
    getState: jest.Mock<any, any, any>;
};
