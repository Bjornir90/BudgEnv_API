import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express()

app.get('/', (req, res) => res.send('Hello World!'))

        // tslint:disable-next-line:no-console
console.log("Environnement : "+process.env.NODE_ENV);

if(process.env.NODE_ENV === "development"){
    app.listen(process.env.PORT, () => {
        // tslint:disable-next-line:no-console
        console.log("API server started on "+process.env.PORT)
    });
}

// export 'app'
module.exports = app