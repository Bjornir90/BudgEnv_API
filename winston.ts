import winston from "winston";
import DetaTransport from "./deta_transport";
import dotenv from "dotenv";

dotenv.config();

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

  const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
  }

  winston.addColors(colors)

  const consoleCombinedFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf((info: any) => {
      return `${info.timestamp} ${info.level} : ${info.message}`;
    })
  )

  const detaCombinedFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  )

  const transports = [
    new winston.transports.Console({format: consoleCombinedFormat}),
    new DetaTransport({project_key: process.env.DETA_PROJECT_KEY as string, base_name: process.env.DETA_LOG_BASE as string, level: "error", format: detaCombinedFormat})
  ]

  const Logger: any = winston.createLogger({
    level: level(),
    levels,
    transports
  })

export default Logger;


