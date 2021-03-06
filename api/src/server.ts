import Koa from 'koa';
import jwt from 'koa-jwt';
import bodyParser from 'koa-bodyparser';
import helmet from 'koa-helmet';
import cors from '@koa/cors';
import winston from 'winston';
import { createConnection } from 'typeorm';
import 'reflect-metadata';
import * as PostgressConnectionStringParser from 'pg-connection-string';

import { logger } from './logging';
import { config } from './config';
import { unprotectedRouter } from './unprotectedRoutes';
import { protectedRouter } from './protectedRoutes';

// Get DB connection options from env variable
const connectionOptions = PostgressConnectionStringParser.parse(config.databaseUrl);

const connectDb = () => {
    return createConnection({
        type: 'postgres',
        host: connectionOptions.host,
        port: connectionOptions.port && parseInt(connectionOptions.port, 10),
        username: connectionOptions.user,
        password: connectionOptions.password,
        database: connectionOptions.database,
        synchronize: config.isDevMode,
        logging: false,
        entities: config.dbEntitiesPath,
        extra: {
            ssl: config.dbsslconn, // if not development, will use SSL
        },
    });
};

connectDb()
    .then(async (connection) => {
        const app = new Koa();

        // Provides important security headers to make your app more secure
        app.use(helmet());

        // Enable cors with default options
        app.use(cors());

        // Logger middleware -> use winston as logger (logging.ts with config)
        app.use(logger(winston));

        // Enable bodyParser with default options
        app.use(bodyParser());

        // these routes are NOT protected by the JWT middleware, also include middleware to respond with "Method Not Allowed - 405".
        app.use(unprotectedRouter.routes()).use(unprotectedRouter.allowedMethods());

        // JWT middleware -> below this line routes are only reached if JWT token is valid, secret as env variable
        // do not protect swagger-json and swagger-html endpoints
        // app.use(jwt({ secret: config.jwtSecret }).unless({ path: [/^\/swagger-/] }));

        // These routes are protected by the JWT middleware, also include middleware to respond with "Method Not Allowed - 405".
        app.use(protectedRouter.routes()).use(protectedRouter.allowedMethods());

        app.listen(config.port);

        console.log(`Server running on port ${config.port}`);

    })
    .catch(error => console.log('TypeORM connection error: ', error));
