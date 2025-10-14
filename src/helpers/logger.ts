import { createLogger, format, transports } from 'winston';
const { combine, timestamp, json, errors } = format;

const logLevels = {
	fatal: 0,
	error: 1,
	warn: 2,
	info: 3,
	debug: 4,
	trace: 5,
};

export const logger = createLogger({
	transports: [new transports.Console()],
	format: combine(errors({ stack: true }), timestamp(), json()),
	levels: logLevels,
	silent: !process.env.LOGGER && process.env.NODE_ENV === 'test',
	defaultMeta: {
		version: process.env.VERSION,
	},
	exceptionHandlers: [new transports.Console({ consoleWarnLevels: ['error'] })],
	rejectionHandlers: [new transports.Console({ consoleWarnLevels: ['error'] })],
});
