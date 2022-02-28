import express, { Router, json } from "express";
import { Deta } from "deta";
import dotenv from "dotenv";
import Base from "deta/dist/types/base";
import Logger from "./winston";
import reasons from "./error_reason";
import randomString from "randomstring";
import jwt from "jsonwebtoken";
import argon2 from "argon2";
import { Category, ValidationInfo, GoalType, Budget, ErrorResponse, MonthlyAffectation, Transaction, User } from "./common";

dotenv.config();

const MAX_LENGTH_CATEGORY_NAME = 100;
const AUTHORIZED_DOMAINS = ["https://budgenv.deta.dev", "https://wv5y8g.deta.dev"];

const deta = Deta(process.env.DETA_PROJECT_KEY);


let dbBudget: Base;
let dbTransaction: Base;
let dbAffectation: Base;
let dbCategory: Base;
let dbUser: Base;
if (process.env.DETA_BUDGET_BASE !== undefined && process.env.DETA_TRANSACTION_BASE !== undefined && process.env.DETA_AFFECTATION_BASE !== undefined && process.env.DETA_LOG_BASE !== undefined && process.env.DETA_CATEGORY_BASE !== undefined && process.env.DETA_USER_BASE !== undefined) {
    dbBudget = deta.Base(process.env.DETA_BUDGET_BASE);
    dbTransaction = deta.Base(process.env.DETA_TRANSACTION_BASE);
    dbAffectation = deta.Base(process.env.DETA_AFFECTATION_BASE);
    dbCategory = deta.Base(process.env.DETA_CATEGORY_BASE);
    dbUser = deta.Base(process.env.DETA_USER_BASE);
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
        const originHeader = req.headers.origin;

        if(originHeader !== undefined && AUTHORIZED_DOMAINS.includes(originHeader)){
            res.setHeader("Access-Control-Allow-Origin", originHeader);
        }

        res.setHeader('Content-Type', 'application/json');
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

router.post("/tokens", (req, res) => {
    const pass = req.body.password;
    const username = req.body.username;

    dbUser.fetch().then(value => {
        const userInBase = (value.items.find((user) => user.name === username) as User);

        if(userInBase === undefined){
            res.status(401).json(generateErrorResponse(reasons.invalidLogin, "Username is not valid"));
            return;
        }

        argon2.verify(userInBase.password, pass).then(isValid => {
            if(isValid){
                const token = jwt.sign({ 'authorizedBudgetKeys': userInBase.allowedBudgetKeys }, process.env.API_SECRET as string, { expiresIn: 60 * 60 * 24 * 7 });// Expires in 1 week

                res.status(200).json({ 'token': token });
            } else {
                res.status(401).json(generateErrorResponse(reasons.invalidLogin, "Password is not valid"));
            }
        }, error => {
            res.status(500).json(generateErrorResponse(reasons.unknown, error));
        });
    }, err => {
        res.status(500).json(generateErrorResponse(reasons.unknown, err));
    });
});

router.post("/users", (req, res) => {
    const user = req.body as User;
    argon2.hash(user.password).then(hash => {
        user.password = hash;
        dbUser.put(user).then(value => {
            res.status(201).json(value);
        }, err => {
            res.status(500).json(generateErrorResponse(reasons.unknown, err));
        });
    })

});

router.get("/budgets", (req, res) => {
    dbBudget.fetch().then(value => {
        res.status(200).json(value.items);
    });
});

router.get("/budgets/:budgetId", (req, res) => {
    dbBudget.get(req.params.budgetId).then(value => {
        res.status(200).json(value);
    }, err => {
        res.status(500).json(err);
    })
});

// TODO validation
router.post("/budgets/:budgetId", (req, res) => {
    dbBudget.put(req.body, req.params.budgetId).then(value => {
        res.status(201).json(value);
    }, err => {
        res.status(500).json(err);
    });
});

router.post("/budgets/:budgetId/categories", (req, res) => {
    const category = req.body as Category;

    const validInfo = validateCategoryPost(category);
    if (validInfo.reason !== undefined) {
        res.status(400).json(generateErrorResponse(validInfo.reason, "Could not create new category"));
    }

    category.budgetId = req.params.budgetId;

    dbCategory.put(category).then(value => {
        res.status(201).json(value);
    }, err => {
        res.status(500).json(generateErrorResponse(reasons.unknown, "Could not create new category"));
    });

});

router.get("/budgets/:budgetId/categories", (req, res) => {
    dbCategory.fetch({"budgetId": req.params.budgetId}, { limit: 100 }).then(value => {
        if(value.count === 0){
            res.status(404).json(generateErrorResponse(reasons.notFound, "No categories were found for this budget"));
        }
        res.status(200).json(value.items);
    }, err => {
        res.status(500).json(generateErrorResponse(reasons.unknown, err));
    });
});

router.get("/budgets/:budgetId/affectations/month/:date", (req, res) => {
    const date = req.params.date;
    if (!validateMonthDate(date)) {
        res.status(400).json(generateErrorResponse(reasons.badDateFormat, "The date isn't formatted as YYYY-MM"));
        return;
    }

    dbAffectation.fetch({ date, "budgetId": req.params.budgetId}).then(value => {
        res.status(200).json(value.items);
    }, err => {
        res.status(404).json(err);
    });

});

router.post("/budgets/:budgetId/affectations", (req, res) => {
    const monthlyAffectation = req.body as MonthlyAffectation;

    monthlyAffectation.budgetId = req.params.budgetId;

    dbAffectation.put(monthlyAffectation).then(value => {

        // TODO error management, rollback as needed
        dbBudget.update({"unaffectedAmount": dbBudget.util.increment(-monthlyAffectation.affectation.amount)}, req.params.budgetId);

        dbCategory.update({"amount": dbCategory.util.increment(monthlyAffectation.affectation.amount)}, monthlyAffectation.affectation.categoryId);

        res.status(201).json(value);
    }, err => {
        res.status(500).json(generateErrorResponse(reasons.unknown, err));
    });
});

router.get("/budgets/:budgetId/transactions/range", (req, res) => {

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

    dbTransaction.fetch({
            "comparableDate?r": [getComparableDate(startDate), getComparableDate(endDate)],
            "budgetId": req.params.budgetId
        },
        { limit: 100 }).then(value => {
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

router.get("/transactions/:id", (req, res) => {
    const id: string = req.params.id as string;

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

router.get("/budgets/:budgetId/transactions/last/:number", (req, res) => {
    const numberOfItemsToLoad = parseInt(req.params.number, 10);

    dbTransaction.fetch({"budgetId": req.params.budgetId}, { limit: numberOfItemsToLoad}).then(value => {

        Logger.info("Retrieved " + value.count + " transactions out of the " + numberOfItemsToLoad + "requested");

        if (value.count === 0) {
            res.status(404).json(generateErrorResponse(reasons.notFound, "No transactions found"));
            return;
        }

        res.status(200).json(value.items);

    }, err => {
        res.status(500).json(err);
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