import type { Core } from '@strapi/strapi';

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:', 'http://kit.local:1337', 'http://localhost:1337', 'https://firedup.app'],
          'img-src': ["'self'", 'data:', 'blob:', 'https://market-assets.strapi.io', 'http://kit.local:1337', 'https://firedup.app'],
          'media-src': ["'self'", 'data:', 'blob:', 'http://kit.local:1337', 'https://firedup.app'],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: ['http://kit.local:1337', 'http://localhost:1337', 'http://kit.local:3100', 'https://firedup.app'],
      headers: '*',
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
