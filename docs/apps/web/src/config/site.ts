import { absoluteUrl } from '@/lib/utils'
import en from '@/i18n/locales/en.json'
import pt from '@/i18n/locales/pt.json'

export const siteConfig = {
  name: 'cleo',

  description: {
    en: en.site.description,
    pt: pt.site.description,
  },

  url: process.env.NEXT_PUBLIC_APP_URL,

  og: {
    image: absoluteUrl('/og.jpg'),

    size: {
      width: 1200,
      height: 630,
    },
  },

  app: {
    latestVersion: '1.0.0',
  },

  author: {
    name: 'Fofsinx',
    site: 'https://blog.theboring.name',
  },

  links: {
    twitter: {
      label: 'Twitter',
      username: '@0xalioth',
      url: 'https://twitter.com/0xalioth',
    },

    github: {
      label: 'GitHub',
      url: 'https://github.com/fofsinx/cleo',
    },
  },
} as const

export type SiteConfig = typeof siteConfig
