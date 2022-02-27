export enum GoalType {
    SaveByDate = "SAVEBYDATE",
    SaveAmount = "SAVEAMOUNT",
    SaveMonthly = "SAVEMONTHLY",
    SpendMonthly = "SPENDMONTHLY"
};

export type Goal = {
    amount: number;
    date?: string;
    goalType: GoalType;
};

export type Category = {
    amount: number;// Amount of money present in the category (affected - spent)
    name: string;
    goal?: Goal;
    note: string | null;
    budgetId: string;
    key: string;// Used to reference this category in transactions and affectations
};

export type Budget = {
    unaffectedAmount: number;
    key: string;
    name: string;
};

export type Transaction = {
    date: string;
    comparableDate?: number;
    amount: number;// Amount in cents
    memo: string;
    payee: string;
    categoryId: string;
    budgetId: string;
    key?: string; // The id assigned by Deta base
};

export type Affectation = {
    categoryId: string;
    amount: number;
};

export type MonthlyAffectation = {
    date: string;
    budgetId: string;
    affectation: Affectation;
};

export type ValidationInfo = {
    reason?: string;
};

export type ErrorResponse = {
    reason: string;
    message: string;
};