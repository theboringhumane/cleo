import { absoluteUrl } from '@/lib/utils'
import en from '@/i18n/locales/en.json'
import pt from '@/i18n/locales/pt.json'

export const siteConfig = {
  name: 'Cleo - Task processing made elegant',

  description: {
    en: en.site.description,
    pt: pt.site.description,
  },

  url: process.env.NEXT_PUBLIC_APP_URL,

  og: {
    image: 'https://opengraph.b-cdn.net/production/images/9448bba5-1ea1-455a-bb2e-792dcd81844e.jpg?token=r-XJUN3KC9RJnpltNm941PhPsJ43Lr5tllpBqLDtIwo&height=1024&width=1024&expires=33269921094',
    size: {
      width: 1024,
      height: 1024,
    },
  },

  app: {
    latestVersion: '1.0.9',
  },

  author: {
    name: 'Fofsinx',
    site: 'https://blog.theboring.name',
  },

  links: {
    discord: {
      label: 'Discord',
      url: 'https://discord.gg/MXQgb9s5bA',
    },

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
