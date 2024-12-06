import { FastifyInstance } from 'fastify';
export declare function createServer(): Promise<FastifyInstance>;
export declare function startServer(port?: number): Promise<void>;
