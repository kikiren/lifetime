import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { book } from "./book.js"

const { OCP_APIM_SUBSCRIPTION_KEY, LIFETIME_USERNAME, LIFETIME_PASSWORD } = process.env;
const lookUpDayCount = 10
const programList = [
    'departmentDescription:Pickleball|Pickleball Open Play: Competitive Mid Intermediate',
    'departmentDescription:Pickleball|Pickleball Open Play: Intermediate',
    'departmentDescription:Pickleball|Pickleball Open Play: Low Intermediate',
]

book(lookUpDayCount, programList, OCP_APIM_SUBSCRIPTION_KEY, LIFETIME_USERNAME, LIFETIME_PASSWORD);