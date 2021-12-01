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

type Transaction = {
    date: string;
    amount: number;//Amount in cents
    memo: string;
    payee: string;
    key: string; //The id assigned by Deta base
};


router.get("/budgets", (req, res) => {
    dbBudget.fetch().then(value => {
        res.status(200).json(value.items);
    });
});

router.get("/transactions/:id", (req, res) => {
    const id: string = req.params.id;

    dbTransaction.get(id).then(value => {
        res.status(200).json(value);
    });
});

router.get("/transactions/range", (req, res) => {

    const startDate: string = req.query.start_date as string;
    const endDate: string = req.query.end_date as string;

    dbTransaction.fetch({"date?r": [startDate, endDate]}, {limit: 100}).then(value => {
        res.status(200).json(value.items);
    });
});

/*
    Create a new transaction
    Transaction in the body
 */
router.post("/transactions", (req, res) => {
    let input = req.body as Transaction;

    dbTransaction.put(input).then(value => {
        res.status(201).json(value);
    }, err => {
        Logger.error("Error when creating transaction : "+err);
        res.status(500).json('{"error":"Could not create transaction"}');
    });
});

export default router;