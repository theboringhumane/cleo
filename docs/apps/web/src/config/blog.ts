import type { BlogConfig } from '../lib/opendocs/types/blog'

export const blogConfig: BlogConfig = {
  mainNav: [
    {
      href: '/blog',

      title: {
        en: 'Blog',
      },
    },
  ],

  authors: [
    {
      /* the id property must be the same as author_id in the blog post mdx files required for the computed field
        in contentlayer.config.ts so we can get the author details from the blogConfig by comparing the author_id
        with the id below
      */
      id: 'fofsinx',
      name: 'Fofsinx',
      image: 'https://avatars.githubusercontent.com/u/46974223?v=4',
      site: 'https://blog.theboring.name',
      email: 'thehuman@theboring.name',

      bio: {
        en: 'Software Engineer | Writer | Designer',
        pt: 'Engenheiro de Software | Escritor | Designer',
      },

      social: {
        github: 'fofsinx',
        twitter: '@0xalioth',
        youtube: 'fofsinx',
        linkedin: 'iamharshdev',
      },
    },
  ],

  rss: [
    {
      type: 'xml',
      file: 'blog.xml',
      contentType: 'application/xml',
    },

    {
      type: 'json',
      file: 'blog.json',
      contentType: 'application/json',
    },
  ],
} as const
