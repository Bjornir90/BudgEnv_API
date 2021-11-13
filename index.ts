import express from "express";
import dotenv from "dotenv";
import router from "./router.js";
import winston from "winston";
import winstonExpress from "express-winston";

dotenv.config();

const app = express()

app.use(winstonExpress.logger({
    transports: [
        new winston.transports.Console()
      ],
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.json()
      ),
      meta: true, // optional: control whether you want to log the meta data about the request (default to true)
      expressFormat: true, // Use the default Express/morgan request formatting. Enabling this will override any msg if true. Will only output colors with colorize set to true
      colorize: true, // Color the text and status code, using the Express/morgan color palette (text: gray, status: default green, 3XX cyan, 4XX yellow, 5XX red).
      ignoreRoute (req, res) { return false; } // optional: allows to skip some log messages based on request and/or response
}));
app.use("/", router);


if(process.env.NODE_ENV === "development"){
    app.listen(process.env.PORT);
}

// export 'app'
module.exports = app