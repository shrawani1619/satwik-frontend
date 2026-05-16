/** Indian grouping: 1,00,000 (lakh), 1,00,00,000 (crore) */
export const formatIndianNumber = (amount, options = {}) => {
    if (amount === undefined || amount === null || amount === '') return '-';
    const n = Number(String(amount).replace(/,/g, ''));
    if (!Number.isFinite(n)) return '-';
    return new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: options.maximumFractionDigits ?? 0,
        minimumFractionDigits: options.minimumFractionDigits ?? 0,
    }).format(n);
};

/** ₹ with Indian comma placement (en-IN) */
export const formatIndianRupee = (amount) => {
    if (amount === undefined || amount === null || amount === '-') return '-';
    const formatted = formatIndianNumber(amount);
    if (formatted === '-') return '-';
    return `₹${formatted}`;
};

// Utility for currency formatting (Indian locale)
export const formatCurrency = (amount) => {
    if (amount === undefined || amount === null || amount === '-') return '-';
    const n = Number(String(amount).replace(/,/g, ''));
    if (!Number.isFinite(n)) return '-';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(n);
};

// Utility for formatting amounts in K, M, L, Cr format
export const formatInCrores = (amount) => {
    if (amount === undefined || amount === null || amount === 0) return '₹0';
    
    const crore = 10000000; // 1 crore = 1,00,00,000
    const lakh = 100000;    // 1 lakh = 1,00,000
    const million = 1000000; // 1 million = 10,00,000
    const thousand = 1000;   // 1 thousand = 1,000
    
    // Format in Crores
    if (amount >= crore) {
        return `₹${(amount / crore).toFixed(2)}Cr`;
    }
    
    // Format in Lakhs
    if (amount >= lakh) {
        return `₹${(amount / lakh).toFixed(2)}L`;
    }
    
    // Format in Millions
    if (amount >= million) {
        return `₹${(amount / million).toFixed(2)}M`;
    }
    
    // Format in Thousands
    if (amount >= thousand) {
        return `₹${(amount / thousand).toFixed(2)}K`;
    }
    
    // Format as is
    return `₹${amount.toLocaleString('en-IN')}`;
};