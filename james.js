import dotenv from 'dotenv';
dotenv.config({ path: '.env.james' });

import {
    getToken, getJWT, getSchedule, getEventDetail,
    getRegistrationDetail, startRegistration,
    completeRegistration, checkReservationStatus
} from './requests.js';


const { OCP_APIM_SUBSCRIPTION_KEY, LIFETIME_USERNAME, LIFETIME_PASSWORD, PROGRAM_LIST, LOOKUP_DAY_COUNT } = process.env;
const lookUpDayCount = parseInt(LOOKUP_DAY_COUNT) || 10
const programList = PROGRAM_LIST.split("$$$")

book(lookUpDayCount, programList, OCP_APIM_SUBSCRIPTION_KEY, LIFETIME_USERNAME, LIFETIME_PASSWORD);


async function book(lookUpDayCount, programList, apiKey, ltUsername, ltPassword) {
    try {
        console.log("--- Step 1: Authentication ---");
        const { token, ssoId } = await getToken({
            username: ltUsername,
            password: ltPassword,
            ocpApimSubscriptionKey: apiKey
        });
        const { jwt, memberId } = await getJWT({ token, ocpApimSubscriptionKey: apiKey });

        // 公用请求参数
        const apiCtx = { token, jwt, ocpApimSubscriptionKey: apiKey, ssoId, memberId };

        console.log("\n--- Step 2: Fetching Schedule ---");

        const schedule = await getSchedule({ ...apiCtx, lookUpDayCount, programList });
        const flattenedEvents = schedule.results.flatMap(day =>
            day.dayParts.flatMap(dp =>
                dp.startTimes.flatMap(st => st.activities)
            )
        );
        console.log(`Stats: Events Fetched [${flattenedEvents.length}]`)
        // saveJson('1-initial-schedule', flattenedEvents);


        console.log("\n--- Step 3: Getting Detailed Info ---");
        // 过滤掉候补名单，并并行获取详情
        const detailTasks = flattenedEvents
            .filter(event => event.isRegistrable && !event.isCanceled)
            .map(async (event) => {
                const details = await getEventDetail({ ...apiCtx, eventId: event.id });
                const regInfo = await getRegistrationDetail({ ...apiCtx, eventId: event.id });

                // 合并数据并清理不需要的字段
                const merged = { ...event, ...details, ...regInfo };
                ["image", "focusTags", "nextOccurrences", "whatToKnowTags", "description"].forEach(f => delete merged[f]);
                return merged;
            });

        const allEvents = await Promise.all(detailTasks);

        // 分类逻辑
        let registeredCount = 0;
        let tooSoonCount = 0;

        // 筛选符合条件的预定目标
        const myReservableEvents = allEvents.filter(e => {

            const isUnregistered = e.registeredMembers?.length === 0;
            if (!isUnregistered) registeredCount++

            const notTooSoon = !e.notifications?.some(n => n.type === "tooSoon");
            if (!notTooSoon) tooSoonCount++

            return isUnregistered && notTooSoon;
        });

        console.log(`Stats: TotalReservable[${allEvents.length}] | Reserved[${registeredCount}] | TooSoon[${tooSoonCount}] | My Reservable[${myReservableEvents.length}]`);

        if (myReservableEvents.length === 0) {
            console.log("No events to book at this time.");
            return;
        }

        console.log("\n--- Step 4: Booking Process ---");
        const reservationTasks = myReservableEvents.map(async (event) => {
            try {
                // 注意：这里用了安全解构，防止 startRegistration 返回非对象
                const regData = await startRegistration({ ...apiCtx, eventId: event.id });
                if (!regData || (!regData.regId && !Array.isArray(regData))) {
                    throw new Error(`Invalid registration start response for event ${event.id}`);
                }

                // 兼容数组或对象返回格式
                const regId = regData.regId || regData[0];
                const agreementId = regData.agreementId || regData[1];

                console.log(`[${regId}] Booking initiated...`);

                await completeRegistration({ ...apiCtx, regId, agreementId });
                console.log(`[${regId}] Completion request sent.`);

                const status = await checkReservationStatus({ ...apiCtx, regId });

                return status;
            } catch (err) {
                console.error(`[Error] Failed to book event ${event.id}:`, err.message);
                return null;
            }
        });

        const results = await Promise.all(reservationTasks);
        console.table(results)

    } catch (error) {
        console.error("Critical Script Error:", error);
    }
};
