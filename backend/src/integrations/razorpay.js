/**
 * RupeeFast — Razorpay Integration Adapter
 *
 * Re-exports the Razorpay payment gateway wrapper from its canonical location.
 * Route modules import from `../integrations/razorpay` instead of `../razorpay`.
 */
module.exports = require('../razorpay');
