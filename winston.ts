import winston from "winston";

const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  }

  const isDevelopment = () => {
    const env = process.env.NODE_ENV || 'development';
    return env === 'development';
  }

  const level = () => {
    return isDevelopment() ? 'debug' : 'warn'
  }

  const format = () => {
    return isDevelopment() ? winston.format.printf((info: any) => `${info.timestamp} ${info.level}: ${info.message}`) : winston.format.json();
  }

  const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
  }

  winston.addColors(colors)

  const combinedFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
    winston.format.colorize({ all: true }),
    format(),
  )

  const transports = [
    new winston.transports.Console(),
  ]

  const Logger: any = winston.createLogger({
    level: level(),
    levels,
    format,
    transports,
  })

export default Logger;


