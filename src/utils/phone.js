// Convert Yemen local phone to international format
export const normalizeYemenPhone = (phone) => {
    if (!phone) return phone;

    // Remove spaces and "+"
    phone = phone.replace(/\s+/g, "").replace("+", "");

    // Already international
    if (phone.startsWith("967")) return phone;

    // Local format
    return `967${phone}`;
};

// Validate Yemen phone number
export const isValidYemenPhone = (phone) => {
    return /^7\d{8}$/.test(phone);
};
