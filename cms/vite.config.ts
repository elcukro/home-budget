import { mergeConfig } from 'vite';

export default (config) => {
  return mergeConfig(config, {
    server: {
      host: '0.0.0.0',
      port: 1337,
      strictPort: false,
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        'kit.local',
        '.kit.local'
      ],
    },
  });
};
