import { init } from "../../src/server";
import tape from 'tape';

import _types from '../../src/types';

export const bootstrap = (() => {
    const app = init();
    tape.onFinish(async () => await (await app).close());

    return async (t: tape.Test) => {
        return {
            app: await app
        };
    }
})();