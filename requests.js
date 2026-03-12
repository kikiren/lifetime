export const getToken = async ({ username, password, ocpApimSubscriptionKey }) => {
    const response = await fetch("https://api.lifetimefitness.com/auth/v2/login", {
        "headers": {
            "content-type": "application/json; charset=UTF-8",
            "sec-ch-ua": "\"Not:A-Brand\";v=\"99\", \"Google Chrome\";v=\"145\", \"Chromium\";v=\"145\"",
            "ocp-apim-subscription-key": ocpApimSubscriptionKey,
            "Referer": "https://my.lifetime.life/"
        },
        "body": JSON.stringify({ username, password }),
        "method": "POST"
    });
    const data = await response.json();
    return { token: data.token, ssoId: data.ssoId };
}

export const getJWT = async ({ token, ocpApimSubscriptionKey }) => {
    const response = await fetch("https://api.lifetimefitness.com/user-profile/profile", {
        "headers": {
            "accept": "application/json, text/plain, */*",
            "authorization": token,
            "ocp-apim-subscription-key": ocpApimSubscriptionKey,
            "sec-ch-ua": "\"Not:A-Brand\";v=\"99\", \"Google Chrome\";v=\"145\", \"Chromium\";v=\"145\"",
            "sec-ch-ua-platform": "\"macOS\"",
            "x-remember": token,
            "Referer": "https://my.lifetime.life/"
        },
        "method": "GET"
    })
    const data = await response.json();
    return { jwt: data.jwt, memberId: data.memberDetails.memberId };
}

export const getSchedule = async ({ token, jwt, ocpApimSubscriptionKey, programList, startNDayAfterToday, endNDayAfterToday }) => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + startNDayAfterToday);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + endNDayAfterToday);
    const pickleballScheduleParams = {
        // 动态生成的日期
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],

        // 筛选条件
        tags: [
            'interest:Pickleball Open Play',
            'format:Class',
            ...programList
        ],
        locations: 'Burlington',
        isFree: false,

        // 聚合/侧边栏分类
        facet: [
            'tags:interest',
            'tags:departmentDescription',
            'tags:timeOfDay',
            'tags:age',
            'tags:skillLevel',
            'tags:intensity',
            'leader.name.displayname',
            'location.name'
        ],

        // 分页设置
        page: 1,
        pageSize: 750
    };
    const baseUrl = 'https://api.lifetimefitness.com/ux/web-schedules/v2/schedules/classes';
    const searchParams = new URLSearchParams();
    Object.entries(pickleballScheduleParams).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach(v => searchParams.append(key, v));
        } else {
            searchParams.append(key, value);
        }
    });

    const finalUrl = `${baseUrl}?${searchParams.toString()}`;
    const response = await fetch(finalUrl, {
        "headers": {
            "content-type": "application/json",
            "ocp-apim-subscription-key": ocpApimSubscriptionKey,
            "x-ltf-jwe": token,
            "x-ltf-profile": jwt,
            "Referer": "https://my.lifetime.life/"
        },
        "method": "GET"
    })
    const data = await response.json();
    return data;
}

export const getEventDetail = async ({ token, jwt, ocpApimSubscriptionKey, eventId }) => {
    try {
        const response = await fetch(`https://api.lifetimefitness.com/ux/web-schedules/v2/events/${eventId}`, {
            "headers": {
                "accept": "application/json, text/plain, */*",
                "ocp-apim-subscription-key": ocpApimSubscriptionKey,
                "x-ltf-jwe": token,
                "x-ltf-profile": jwt,
                "Referer": "https://my.lifetime.life/"
            },
            "method": "GET"
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error.message)
        return null
    }
}

export const getRegistrationDetail = async ({ token, jwt, ocpApimSubscriptionKey, eventId, ssoId }) => {

    try {
        const response = await fetch(`https://api.lifetimefitness.com/ux/web-schedules/v2/events/${eventId}/registration`, {
            "headers": {
                "accept": "application/json, text/plain, */*",
                "ocp-apim-subscription-key": ocpApimSubscriptionKey,
                "x-ltf-jwe": token,
                "x-ltf-profile": jwt,
                "x-ltf-ssoid": ssoId,
                "Referer": "https://my.lifetime.life/",
                "x-timestamp": new Date().toISOString(),
            },
            "method": "GET"
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(error.message)
        return null
    }
}

export const startRegistration = async ({ token, jwt, ocpApimSubscriptionKey, eventId, ssoId, memberId }) => {
    try {
        const response = await fetch("https://api.lifetimefitness.com/sys/registrations/V3/ux/event", {
            "headers": {
                "content-type": "application/json",
                "ocp-apim-subscription-key": ocpApimSubscriptionKey,
                "x-ltf-jwe": token,
                "x-ltf-profile": jwt,
                "Referer": "https://my.lifetime.life/",
                "x-ltf-ssoid": ssoId,
                "x-timestamp": new Date().toISOString(),
            },
            "body": JSON.stringify({ eventId, memberId: [memberId] }),
            "method": "POST"
        });
        const data = await response.json();
        return { regId: data.regId, agreementId: data.agreement.agreementId };
    } catch (error) {
        console.error(error.message)
        return { regId: null, agreementId: null }
    }
}

export const completeRegistration = async ({ token, jwt, ocpApimSubscriptionKey, regId, ssoId, memberId, agreementId }) => {
    try {
        await fetch(`https://api.lifetimefitness.com/sys/registrations/V3/ux/event/${regId}/complete`, {
            "headers": {
                "content-type": "application/json",
                "ocp-apim-subscription-key": ocpApimSubscriptionKey,
                "x-ltf-jwe": token,
                "x-ltf-profile": jwt,
                "Referer": "https://my.lifetime.life/",
                "x-ltf-ssoid": ssoId,
                "x-timestamp": new Date().toISOString(),
            },
            "body": JSON.stringify({
                acceptedDocuments: [agreementId], memberId: [memberId]
            }),
            "method": "PUT"
        });
    } catch (error) {
        console.error(error.message)
        return null
    }
}

export const checkReservationStatus = async ({ token, jwt, ocpApimSubscriptionKey, regId, ssoId }) => {
    try {
        const response = await fetch(`https://api.lifetimefitness.com/sys/registrations/V3/ux/event/${regId}`, {
            "headers": {
                "accept": "application/json, text/plain, */*",
                "ocp-apim-subscription-key": ocpApimSubscriptionKey,
                "x-ltf-jwe": token,
                "x-ltf-profile": jwt,
                "x-ltf-ssoid": ssoId,
                "Referer": "https://my.lifetime.life/",
                "x-timestamp": new Date().toISOString(),
            },
            "body": null,
            "method": "GET"
        });
        const { regStatus, eventName, start } = await response.json()
        return { regStatus, eventName, start }
    } catch (error) {
        console.error(error.message)
        return null
    }
}