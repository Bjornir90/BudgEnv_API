import express, { Router, json } from "express";
import {Deta} from "deta";
import dotenv from "dotenv";
import Base from "deta/dist/types/base";
import Logger from "./winston";
import reasons from "./error_reason";

dotenv.config();

const maxLengthCategoryName = 100;
const defaultBudget = "DEFAULT";

const deta = Deta(process.env.DETA_PROJECT_KEY);
let dbBudget: Base;
let dbTransaction: Base;
let dbAffectation: Base;
if(process.env.DETA_BUDGET_BASE !== undefined && process.env.DETA_TRANSACTION_BASE !== undefined && process.env.DETA_AFFECTATION_BASE !== undefined){
    dbBudget = deta.Base(process.env.DETA_BUDGET_BASE);
    dbTransaction = deta.Base(process.env.DETA_TRANSACTION_BASE);
    dbAffectation = deta.Base(process.env.DETA_AFFECTATION_BASE);
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
    date?: string;
    goalType: GoalType;
}

type Category = {
    amount: number;// Amount of money present in the category (affected - spent)
    name: string;
    goal?: Goal;
};

type Budget = {
    categories: [Category];
    key: string;
};

type Transaction = {
    date: string;
    amount: number;// Amount in cents
    memo: string;
    payee: string;
    categoryName: string;
    key: string; // The id assigned by Deta base
};

type Affectation = {
    categoryName: string;
    amount: number;
}

type MonthlyAffectation = {
    date: string;
    affectation: Affectation;
}

type ValidationInfo = {
    reason?: string;
}

type ErrorResponse = {
    reason: string;
    message: string;
}

function validateCategoryPost (category : Category): ValidationInfo {
    if(category.name.length > maxLengthCategoryName) return {reason: reasons.categoryNameTooLong};
    if(category.goal?.goalType === GoalType.SaveByDate && category.goal?.date === null) return {reason: reasons.missingDate};
    return {reason: undefined};
}


router.get("/budgets", (req, res) => {
    dbBudget.fetch().then(value => {
        res.status(200).json(value.items);
    });
});

router.get("/budgets/default", (req, res) => {
    dbBudget.get(defaultBudget).then(value => {
        res.status(200).json(value);
    }, err => {
        res.status(500).json(err);
    })
});

// TODO validation
router.post("/budgets/default", (req, res) => {
    dbBudget.put(req.body, defaultBudget).then(value => {
        res.status(200).json(value);
    }, err => {
        res.status(500).json(err);
    });
});

router.post("/categories", (req, res) => {
    const category = req.body as Category;

    const validInfo = validateCategoryPost(category);
    if(validInfo.reason !== undefined){
        const response: ErrorResponse = {reason: validInfo.reason, message: "Could not create new category"};
        res.status(400).json(response);
    }

    dbBudget.get(defaultBudget).then(value => {

        if(value === null || value === undefined){

            const response: ErrorResponse = {reason: reasons.notFound, message: "The default budget could not be found"};
            res.status(404).json(response);

        } else {

            const budget = (value as Budget);
            const categories = budget.categories;
            categories.push(category);
            budget.categories = categories;

            // The budget object has a key, which means it will replace the one in the base
            dbBudget.put(budget).then(putResponse => {
                res.status(201).json(putResponse);
            }, err => {
                res.status(500).json(err);
            });
        }

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
    const input = req.body as Transaction;

    dbTransaction.put(input).then(value => {
        res.status(201).json(value);
    }, err => {
        Logger.error("Error when creating transaction : "+err);
        res.status(500).json('{"error":"Could not create transaction"}');
    });
});

export default router;