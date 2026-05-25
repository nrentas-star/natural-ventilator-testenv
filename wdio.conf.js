const path = require('path');

exports.config = {
  runner:    'local',
  specs:     ['./tests/**/*.spec.js'],
  maxInstances: 1,

  capabilities: [{
    maxInstances: 1,
    browserName:  'chrome',
    'goog:chromeOptions': {
      args: ['--headless', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900']
    }
  }],

  logLevel:        'warn',
  bail:            0,
  baseUrl:         'http://localhost:3200',
  waitforTimeout:  8000,
  connectionRetryTimeout: 30000,
  connectionRetryCount:   3,

  services:   ['chromedriver'],
  framework:  'mocha',
  mochaOpts:  { ui: 'bdd', timeout: 20000 },

  reporters: [
    'spec',
    ['json', {
      outputDir:      './data/results',
      outputFileFormat: (opts) => `results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    }],
    ['html-nice', {
      outputDir:   './data/results',
      filename:    'report.html',
      reportTitle: 'Moffitt Natural Ventilator Selector — Test Report',
      showInBrowser: false,
      collapseTests: false
    }]
  ]
};
