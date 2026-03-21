/**
 * Dr Pay Admin Module
 * This file is kept for backward compatibility.
 * The main admin logic is now embedded in admin.html directly.
 * This module can be used for future modular admin features.
 */

// Admin utility functions
const AdminUtils = {
    formatDate(dateStr) {
        return new Date(dateStr).toLocaleString('ar-EG', { 
            year: 'numeric', month: 'short', day: 'numeric', 
            hour: '2-digit', minute: '2-digit' 
        });
    },

    formatCurrency(amount) {
        return parseFloat(amount).toFixed(2) + ' ج.م';
    },

    getStatusBadge(status) {
        const map = {
            'active': '<span class="text-emerald-400 text-xs font-bold bg-emerald-400/10 p-1 rounded px-2">مفعل</span>',
            'blocked': '<span class="text-red-400 text-xs font-bold bg-red-400/10 p-1 rounded px-2">محظور</span>',
            'pending': '<span class="text-yellow-400 text-xs font-bold bg-yellow-400/10 p-1 rounded px-2">معلق</span>',
            'approved': '<span class="text-emerald-400 text-xs font-bold bg-emerald-400/10 p-1 rounded px-2">معتمد</span>',
            'rejected': '<span class="text-red-400 text-xs font-bold bg-red-400/10 p-1 rounded px-2">مرفوض</span>',
            'paid': '<span class="text-emerald-400 text-xs font-bold bg-emerald-400/10 p-1 rounded px-2">مدفوع</span>'
        };
        return map[status] || status;
    },

    async apiCall(endpoint, method = 'GET', body = null) {
        try {
            const res = await fetch(`/api?action=${endpoint}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: body ? JSON.stringify(body) : null
            });
            return await res.json();
        } catch (e) {
            console.error('API Error:', e);
            return null;
        }
    }
};

// Export for use in other modules if needed
if (typeof module !== 'undefined') module.exports = AdminUtils;
