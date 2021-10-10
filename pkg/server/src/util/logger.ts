import Pino from 'pino';
import { LOG_LEVEL } from '../config';

const logger = Pino({ level: LOG_LEVEL });

export default logger;
