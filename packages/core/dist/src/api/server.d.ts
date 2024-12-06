import { FastifyInstance } from "fastify";
import { Cleo } from "../index";
export declare function createServer(cleo: Cleo): Promise<FastifyInstance>;
export declare function startServer(cleo: Cleo, port?: number): Promise<void>;
