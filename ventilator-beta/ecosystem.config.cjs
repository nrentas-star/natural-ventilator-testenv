module.exports = {
  apps: [
    {
      name:        'ventilator-beta',
      script:      'server.js',
      cwd:         '/home/master/ventilator-beta',
      instances:   1,
      exec_mode:   'fork',
      watch:       false,
      max_memory_restart: '256M',
      log_file:    '/home/master/ventilator-beta/logs/combined.log',
      out_file:    '/home/master/ventilator-beta/logs/out.log',
      error_file:  '/home/master/ventilator-beta/logs/err.log',
      time:        true,
      env: { NODE_ENV: 'production' },
    },
  ],
};
