import express, { Router, json } from "express";
import {Deta} from "deta";
import dotenv from "dotenv";
import Base from "deta/dist/types/base";

dotenv.config();

const deta = Deta(process.env.DETA_PROJECT_KEY);
let dbBudget: Base;
let dbTransaction: Base;
if(process.env.DETA_BUDGET_BASE !== undefined && process.env.DETA_TRANSACTION_BASE !== undefined){
    dbBudget = deta.Base(process.env.DETA_BUDGET_BASE);
    dbTransaction = deta.Base(process.env.DETA_TRANSACTION_BASE);
} else {

    process.exit(1);
}

const router: Router = express.Router();

enum GoalType {
    SaveByDate = "SAVEBYDATE",
    SaveAmount = "SAVEAMOUNT",
    SaveMonthly = "SAVEMONTHLY",
    SpendMonthly = "SPENDMONTHLY"
}

type Category = {
    amount: number;
    name: string;
    goalType: GoalType;
};

type Budget = {
    categories: [Category];
};


router.get("/budget", (req, res) => {
    dbBudget.fetch();
});

router.get("/transactions", (req, res) => {
    const startDate: string = req.query.start_date as string;
    const endDate: string = req.query.end_date as string;
});

export default router;