module.exports.PaymentService = {
    async authorize({ job, buyer }) { return { provider: 'mock', providerRef: `pi_${(job?._id || 'x').toString()}` }; },
    async capture({ intent }) { return { ok: true, providerRef: intent.providerRef }; },
};