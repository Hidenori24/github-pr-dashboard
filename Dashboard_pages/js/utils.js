// utils.js - 共通ユーティリティ
// 営業日ベース経過時間計算 (平日のみカウント)

/**
 * 指定期間の営業日ベース経過時間(時間)を計算する。
 * 土日を除外し、部分的な初日・最終日も正確に計算。
 * @param {string|Date} startISO PR作成日時 (ISO8601)
 * @param {Date} [endDate=new Date()] 現在日時または評価終了日時
 * @returns {{business_hours:number,business_days:number,total_hours:number}}
 */
function calculateBusinessHours(startISO, endDate = new Date()) {
    if (!startISO) return { business_hours: 0, business_days: 0, total_hours: 0 };
    const start = new Date(startISO);
    if (isNaN(start.getTime())) return { business_hours: 0, business_days: 0, total_hours: 0 };
    if (endDate < start) return { business_hours: 0, business_days: 0, total_hours: 0 };

    const MS_PER_HOUR = 1000 * 60 * 60;
    const MS_PER_DAY = MS_PER_HOUR * 24;

    const totalHours = (endDate - start) / MS_PER_HOUR;

    // 日単位でループして平日の時間だけ加算
    let businessHours = 0;
    // 日付境界の開始を取得
    let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());

    while (cursor < endDate) {
        const dayStart = new Date(cursor);
        const nextDay = new Date(cursor.getTime() + MS_PER_DAY);
        const effectiveStart = dayStart < start ? start : dayStart;
        const effectiveEnd = nextDay > endDate ? endDate : nextDay;

        // 土日(0=日曜,6=土曜)は除外
        const dow = dayStart.getDay();
        if (dow !== 0 && dow !== 6) {
            const diffHours = (effectiveEnd - effectiveStart) / MS_PER_HOUR;
            businessHours += diffHours;
        }
        cursor = nextDay;
    }

    return {
        business_hours: businessHours,
        business_days: businessHours / 24,
        total_hours: totalHours
    };
}

/** フォーマット: 小数1桁に丸め */
function formatOneDecimal(value) {
    return (Math.round(value * 10) / 10).toFixed(1);
}

// グローバルへ公開
window.calculateBusinessHours = calculateBusinessHours;
window.formatOneDecimal = formatOneDecimal;
