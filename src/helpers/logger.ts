import winston from 'winston';

// Custom log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Custom colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Tell winston that you want to link the colors defined above to the severity levels
winston.addColors(colors);

// Choose the aspect of your log customizing the log format
const format = winston.format.combine(
  // Add timestamp to logs
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  // Add colors only in production
  ...(process.env.NODE_ENV !== 'production'
    ? [winston.format.colorize({ all: true })]
    : []),
  // Define format of logs
  winston.format.printf(
    info => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      // Add colors only in production
      ...(process.env.NODE_ENV !== 'production'
        ? [winston.format.colorize({ all: true })]
        : []),
      winston.format.printf(
        info =>
          `${process.env.NODE_ENV !== 'production' ? info.timestamp + ' ' : ''}${info.level}: ${info.message}`
      )
    )
  })
];

// Create the logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  levels,
  silent: process.env.LOGGER !== 'yes' && process.env.NODE_ENV === 'test',
  format,
  transports,
  // Do not exit on handled exceptions
  exitOnError: false
});
