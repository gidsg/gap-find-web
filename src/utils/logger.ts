// eslint-disable-next-line @next/next/no-server-import-in-page
import { NextRequest } from 'next/server';
import { NextApiRequest } from 'next';
import pino from 'pino';
import { HEADERS } from './constants';

const log = pino({
  browser: {
    write(obj) {
      try {
        console.log(JSON.stringify(obj));
      } catch (err) {
        if (err instanceof Error) {
          console.log(JSON.stringify(err, ['name', 'message', 'stack']));
        }
        console.log(JSON.stringify({ message: 'Unknown error type' }));
      }
    },
  },
});

const isProd = process.env.NODE_ENV === 'production';

const CONSOLE_COLOURS = {
  BLACK: '\x1b[30m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
} as const;

const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  HTTP: 'http',
  DEBUG: 'debug',
} as const;

const LOG_COLOURS = {
  [LOG_LEVELS.ERROR]: CONSOLE_COLOURS.RED,
  [LOG_LEVELS.WARN]: CONSOLE_COLOURS.YELLOW,
  [LOG_LEVELS.INFO]: CONSOLE_COLOURS.GREEN,
  [LOG_LEVELS.HTTP]: CONSOLE_COLOURS.MAGENTA,
  [LOG_LEVELS.DEBUG]: CONSOLE_COLOURS.WHITE,
} as const;

type ValueOf<T> = T[keyof T];

type LogLevel = ValueOf<typeof LOG_LEVELS>;

const withLogColour = (text: string, level: LogLevel) =>
  LOG_COLOURS[level] + text + CONSOLE_COLOURS.WHITE;

const formatTime = (date: Date) =>
  `${date.toLocaleTimeString()}.${date.getMilliseconds()}`;

// pino doesn't have a log.http
const getProdLogLevel = (level: LogLevel) =>
  level === LOG_LEVELS.HTTP ? LOG_LEVELS.INFO : level;

const getLoggerWithLevel =
  (level: LogLevel) => (logMessage: string, info?: object | Error) => {
    const date = new Date();
    const time = formatTime(date);
    if (!isProd) {
      console.log(
        `[${time}] ` +
          withLogColour(`${level.toUpperCase()}: ${logMessage}`, level),
      );
      if (info) {
        if (info instanceof Error)
          // object spread ignores properties inherited from prototype
          info = { ...info, message: info.message, stack: info.stack };
        console.dir(info, { depth: null });
      }
    } else log[getProdLogLevel(level)](info, logMessage);
  };

type Logger = Record<LogLevel, ReturnType<typeof getLoggerWithLevel>>;

export const logger = Object.values(LOG_LEVELS).reduce(
  (acc, value) => ({ ...acc, [value]: getLoggerWithLevel(value) }),
  {} as Logger,
);

export const addErrorInfo = (error, req: NextRequest | NextApiRequest) => {
  if (req instanceof NextRequest)
    error.correlationId = req.headers.get(HEADERS.CORRELATION_ID);
  else error.correlationId = req.headers[HEADERS.CORRELATION_ID];
  return error;
};
