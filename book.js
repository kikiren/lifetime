import {
    getToken, getJWT, getSchedule, getEventDetail,
    getRegistrationDetail, startRegistration,
    completeRegistration, checkReservationStatus
} from './requests.js';


export const book = async (lookUpDayCount, programList, apiKey, ltUsername, ltPassword) => {
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
            .filter(e => e.cta?.toLowerCase() !== "waitlist")
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
        let notFitsTimeCount = 0;

        // 筛选符合条件的预定目标
        const myReservableEvents = allEvents.filter(e => {

            const isUnregistered = e.registeredMembers?.length === 0;
            if (!isUnregistered) registeredCount++

            const canReserve = e.registerCta?.text?.toLowerCase() === "reserve";

            const notTooSoon = !e.notifications?.some(n => n.type === "tooSoon");
            if (!notTooSoon) tooSoonCount++

            // 时间过滤逻辑
            const startHour = new Date(e.start).getHours();
            const endHour = new Date(e.end).getHours();
            const fitsTime = startHour !== 12 && startHour <= 18 && endHour !== 12;
            if (!fitsTime) notFitsTimeCount++

            return isUnregistered && canReserve && notTooSoon && fitsTime;
        });

        console.log(`Stats: TotalReservable[${allEvents.length}] | Reserved[${registeredCount}] | TooSoon[${tooSoonCount}] | NotFitsTime:[${notFitsTimeCount}] | My Reservable[${myReservableEvents.length}]`);

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
