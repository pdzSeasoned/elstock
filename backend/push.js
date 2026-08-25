// Stub — real implementation loaded lazily to avoid circular deps
let _sendFn = null;
function setSender(fn) { _sendFn = fn; }
async function sendLowStockNotification(items) { if (_sendFn) return _sendFn(items); }
module.exports = { sendLowStockNotification, setSender };
