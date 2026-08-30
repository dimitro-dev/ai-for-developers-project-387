const base = process.env.LHCI_BASE_URL ?? 'http://localhost:3001';

module.exports = {
  ci: {
    collect: {
      url: [base, `${base}/admin/`],
      numberOfRuns: 3,
    },
    upload: {
      target: 'filesystem',
      outputDir: '.lighthouseci',
    },
  },
};
