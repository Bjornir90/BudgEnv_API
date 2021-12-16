import express, { Router, json } from "express";
import { Deta } from "deta";
import dotenv from "dotenv";
import Base from "deta/dist/types/base";
import Logger from "./winston";
import reasons from "./error_reason";
import randomString from "randomstring";
import jwt from "jsonwebtoken";
import { Category, ValidationInfo, GoalType, Budget, ErrorResponse, MonthlyAffectation, Transaction } from "./common";

dotenv.config();

const MAX_LENGTH_CATEGORY_NAME = 100;
const DEFAULT_BUDGET = "DEFAULT";
const RANDOM_ID_LENGTH = 24;

const deta = Deta(process.env.DETA_PROJECT_KEY);
let dbBudget: Base;
let dbTransaction: Base;
let dbAffectation: Base;
if (process.env.DETA_BUDGET_BASE !== undefined && process.env.DETA_TRANSACTION_BASE !== undefined && process.env.DETA_AFFECTATION_BASE !== undefined && process.env.DETA_LOG_BASE !== undefined) {
    dbBudget = deta.Base(process.env.DETA_BUDGET_BASE);
    dbTransaction = deta.Base(process.env.DETA_TRANSACTION_BASE);
    dbAffectation = deta.Base(process.env.DETA_AFFECTATION_BASE);
} else {
    Logger.error("Databases not defined in environment");
    process.exit(1);
}


if (process.env.API_SECRET === undefined) {
    Logger.error("Missing API secret in environment");
    process.exit(1);
}


const router: Router = express.Router();

function validateCategoryPost(category: Category): ValidationInfo {
    if (category.name.length > MAX_LENGTH_CATEGORY_NAME) return { reason: reasons.categoryNameTooLong };
    if (category.goal?.goalType === GoalType.SaveByDate && category.goal?.date === null) return { reason: reasons.missingDate };
    return { reason: undefined };
}

function putCategoryInBudget(category: Category, budget: Budget): Budget {
    const categories = budget.categories;

    const existingCategoryIndex = categories.findIndex(value => value.id === category.id);
    if (existingCategoryIndex === -1) {
        categories.push(category);
    } else {
        categories.splice(existingCategoryIndex, 1, category);
    }

    return budget;
}

function generateErrorResponse(reason: string, message: string): ErrorResponse {
    return { reason, message };
}

function validateDayDate(date: string): boolean {
    const pattern = new RegExp('^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
    return pattern.test(date);
}

function validateMonthDate(date: string): boolean {
    const pattern = new RegExp('^[0-9]{4}-[0-9]{2}$');
    return pattern.test(date);
}

function getComparableDate(date: string): number {
    return parseInt(date.replace(new RegExp("-", "g"), ""), 10);
}

if (process.env.NODE_ENV === "production") {

    router.use((req, res, next) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader("Access-Control-Allow-Origin", "https://wv5y8g.deta.dev");
        res.setHeader(
            "Access-Control-Allow-Methods",
            "OPTIONS, GET, POST, PUT, PATCH, DELETE"
        );
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

        const authHeader = req.headers.authorization;

        if (req.path === "/token" || req.path === "/token/" || req.method === "OPTIONS") {// Accepts requests even without a token
            next();
            return;
        }

        if (authHeader) {
            try {
                jwt.verify(authHeader.split(" ")[1], process.env.API_SECRET as string); // Presence of env variable checked at startup
                next();
                return;
            } catch (err) {
                Logger.error("Error while verifying token");
                Logger.error(JSON.stringify(err));
                res.status(401).json(generateErrorResponse(reasons.invalidToken, "Token is not valid"));
                return;
            }
        }
    });
}

router.post("/token", (req, res) => {
    const pass = req.body.password;
    const username = req.body.username;

    if (username !== process.env.API_USERNAME || pass !== process.env.API_PASSWORD) {
        Logger.error("Invalid login was provided");
        res.status(401).json(generateErrorResponse(reasons.invalidLogin, "Username or password is not valid"));
        return;
    }

    const token = jwt.sign({ 'access': 'granted' }, process.env.API_SECRET as string, { expiresIn: 60 * 60 * 24 * 7 });// Expires in 1 week

    res.status(200).json({ 'token': token });
})

router.get("/budgets", (req, res) => {
    dbBudget.fetch().then(value => {
        res.status(200).json(value.items);
    });
});

router.get("/budgets/default", (req, res) => {
    dbBudget.get(DEFAULT_BUDGET).then(value => {
        res.status(200).json(value);
        Logger.debug(`Default budget ${value}`);
    }, err => {
        res.status(500).json(err);
    })
});

// TODO validation
router.post("/budgets/default", (req, res) => {
    dbBudget.put(req.body, DEFAULT_BUDGET).then(value => {
        res.status(200).json(value);
    }, err => {
        res.status(500).json(err);
    });
});

router.post("/categories", (req, res) => {
    const category = req.body as Category;

    const validInfo = validateCategoryPost(category);
    if (validInfo.reason !== undefined) {
        res.status(400).json(generateErrorResponse(validInfo.reason, "Could not create new category"));
    }

    category.id = randomString.generate(RANDOM_ID_LENGTH);

    dbBudget.get(DEFAULT_BUDGET).then(value => {

        if (value === null || value === undefined) {

            res.status(404).json(generateErrorResponse(reasons.notFound, "The default budget could not be found"));

        } else {

            const budget = value as Budget;
            putCategoryInBudget(category, budget)

            // The budget object has a key, which means it will replace the one in the base
            dbBudget.put(budget).then(putResponse => {
                res.status(201).json(putResponse);
            }, err => {
                res.status(500).json(err);
            });
        }

    });

});

router.get("/affectations/month/:date", (req, res) => {
    const date = req.params.date;
    if (!validateMonthDate(date)) {
        res.status(400).json(generateErrorResponse(reasons.badDateFormat, "The date isn't formatted as YYYY-MM"));
        return;
    }

    dbAffectation.fetch({ date }).then(value => {
        res.status(200).json(value.items);
    }, err => {
        res.status(404).json(err);
    });

});

router.post("/affectations", (req, res) => {
    const monthlyAffectation = req.body as MonthlyAffectation;

    dbBudget.get(DEFAULT_BUDGET).then(budgetValue => {
        const budget = budgetValue as Budget;
        const correspondingCategory = budget.categories.find(value => {
            return value.id === monthlyAffectation.affectation.categoryId;
        });

        if (correspondingCategory === undefined) {
            res.status(400).json(generateErrorResponse(reasons.invalidCategory, "The category id is not valid"));
        } else {
            // Update the amount in the corresponding category
            correspondingCategory.amount += monthlyAffectation.affectation.amount;
            putCategoryInBudget(correspondingCategory, budget);
            dbBudget.put(budget);

            dbAffectation.put(monthlyAffectation).then(affectationValue => {
                res.status(201).json(affectationValue);
            }, err => {
                res.status(500).json(err);
            });
        }
    });
});

router.get("/transactions/range", (req, res) => {

    const startDate: string = req.query.start_date as string;
    const endDate: string = req.query.end_date as string;

    Logger.debug("Dates range :");
    Logger.debug(startDate);
    Logger.debug(endDate);

    if (!validateDayDate(startDate)) {
        res.status(400).json(generateErrorResponse(reasons.badDateFormat, "The startDate isn't formatted as YYYY-MM-DD"));
        return;
    }
    if (!validateDayDate(endDate)) {
        res.status(400).json(generateErrorResponse(reasons.badDateFormat, "The endDate isn't formatted as YYYY-MM-DD"));
        return;
    }

    dbTransaction.fetch({ "comparableDate?r": [getComparableDate(startDate), getComparableDate(endDate)] }, { limit: 100 }).then(value => {
        Logger.info("Transactions returned " + value.count + "/100");
        if (value.count === 0) {
            res.status(404).json(generateErrorResponse(reasons.notFound, "No transactions found for this range"));
            return;
        }
        res.status(200).json(value.items);
    }, err => {
        res.status(500).json(err);
    });
});

router.get("/transactions", (req, res) => {
    const id: string = req.query.id as string;

    if (id === undefined || id === null) {
        res.status(400).json(generateErrorResponse(reasons.missingId, "The id is required"));
    }

    dbTransaction.get(id).then(value => {
        if (value === null) {
            res.status(404).json(generateErrorResponse(reasons.notFound, "No transactions found for this id"));
        }
        res.status(200).json(value);
    });
});

/*
    Create a new transaction
    Transaction in the body
 */
router.post("/transactions", (req, res) => {
    const input = req.body as Transaction;

    if (!validateDayDate(input.date)) {
        res.status(400).json(generateErrorResponse(reasons.badDateFormat, "The date isn't formatted as YYYY-MM-DD"));
        return;
    }

    input.comparableDate = getComparableDate(input.date);

    dbTransaction.put(input).then(value => {
        res.status(201).json(value);
    }, err => {
        res.status(500).json(err);
    });
});

export default router;