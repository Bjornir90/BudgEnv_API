import express, { Router, json } from "express";
import {Deta} from "deta";
import dotenv from "dotenv";
import Base from "deta/dist/types/base";
import Logger from "./winston";

dotenv.config();

const deta = Deta(process.env.DETA_PROJECT_KEY);
let dbBudget: Base;
let dbTransaction: Base;
if(process.env.DETA_BUDGET_BASE !== undefined && process.env.DETA_TRANSACTION_BASE !== undefined){
    dbBudget = deta.Base(process.env.DETA_BUDGET_BASE);
    dbTransaction = deta.Base(process.env.DETA_TRANSACTION_BASE);
} else {
    Logger.error("Databases not defined in environment");    
    process.exit(1);
}

const router: Router = express.Router();

enum GoalType {
    SaveByDate = "SAVEBYDATE",
    SaveAmount = "SAVEAMOUNT",
    SaveMonthly = "SAVEMONTHLY",
    SpendMonthly = "SPENDMONTHLY"
}

type Goal = {
    amount: number;
    date: string|undefined;
    goalType: GoalType;
}

type Category = {
    amount: number;
    name: string;
    goal: Goal;
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