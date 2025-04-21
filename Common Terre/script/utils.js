export function getCurrentYearAndMonth() {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
}