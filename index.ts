import express from "express";
import dotenv from "dotenv";
import router from "./src/router";
import winston from "winston";
import winstonExpress from "express-winston";

dotenv.config();

const isDevelopment = () => {
  const env = process.env.NODE_ENV || 'development';
  return env === 'development';
}

const format = () => {
  return isDevelopment() ? winston.format.printf((info: any) => `${info.label} ${info.timestamp} ${info.level}: ${info.message}`) : winston.format.json();
}

const app = express()

app.use(express.json())

app.use(winstonExpress.logger({
  transports: [
    new winston.transports.Console()
  ],
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.label({ label: "[HTTP]" }),
    format()
  ),
  msg: (req, res) => { return res.statusCode + " " + req.method + " " + req.url + " " + JSON.stringify(req.headers) + (req.method !== "GET" ? " : " + JSON.stringify(req.body) : "") },
  meta: true, // optional: control whether you want to log the meta data about the request (default to true)
  colorize: true, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
  ignoreRoute(req, res) { return req.url === "/token"; } // Ignore request to /token endpoint, containing sensitive infos
}));
app.use("/", router);


if (process.env.NODE_ENV === "development") {
  app.listen(process.env.PORT);
}

// export 'app'
module.exports = app