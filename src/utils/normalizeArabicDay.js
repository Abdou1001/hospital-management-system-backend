const normalizeArabicDay = (day) => {
    return day.trim().replace(/[أإآ]/g, "ا");
};


export default normalizeArabicDay;