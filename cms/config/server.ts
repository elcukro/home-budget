import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Server => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('URL', 'http://kit.local:1337'),
  proxy: true,
  app: {
    keys: env.array('APP_KEYS'),
  },
});

export default config;
