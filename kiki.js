import dotenv from 'dotenv';
dotenv.config({ path: '.env.kiki' });

import { book } from "./book.js"

const { OCP_APIM_SUBSCRIPTION_KEY, LIFETIME_USERNAME, LIFETIME_PASSWORD, PROGRAM_LIST, LOOKUP_DAY_COUNT } = process.env;
const lookUpDayCount = parseInt(LOOKUP_DAY_COUNT) || 10
const programList = PROGRAM_LIST.split("$$$")

book(lookUpDayCount, programList, OCP_APIM_SUBSCRIPTION_KEY, LIFETIME_USERNAME, LIFETIME_PASSWORD);