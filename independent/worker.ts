import app from 'vinext/server/fetch-handler';
import { createIndependentWorker } from './auth.mjs';
export default createIndependentWorker(app);
