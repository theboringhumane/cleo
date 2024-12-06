/**
 * This file contains the configuration for the documentation
 * to be used by files like:
 * - src/components/command-menu.tsx
 * - src/components/mobile-nav.tsx
 * - src/app/[locale]/docs/layout.tsx
 * - src/lib/opendocs/components/docs/pager.tsx
 */

import type { DocsConfig } from '@/lib/opendocs/types/docs'

export const docsConfig: DocsConfig = {
  mainNav: [
    {
      href: '/docs',
      title: {
        en: 'Documentation',
        pt: 'Documentação',
      },
    },
  ],

  sidebarNav: [
    {
      title: {
        en: 'Getting Started',
        pt: 'Começando', 
      },
      items: [
        {
          href: '/docs',
          title: {
            en: 'Introduction',
            pt: 'Introdução',
          },
          items: [],
        },
        {
          href: '/docs/installation',
          title: {
            en: 'Installation',
            pt: 'Instalação',
          },
          items: [],
        },
        {
          href: '/docs/quick-start',
          title: {
            en: 'Quick Start',
            pt: 'Início Rápido',
          },
          items: [],
        },
        {
          title: {
            en: 'Core Concepts',
          },
          items: [
            {
              href: '/docs/core-concepts#tasks',
              title: {
                en: 'Tasks',
                pt: 'Tarefas',
              },
              items: [],
            },
            {
              href: '/docs/core-concepts#workers',
              title: {
                en: 'Workers',
                pt: 'Trabalhadores',
              },
              items: [],
            },
            {
              href: '/docs/core-concepts#queues',
              title: {
                en: 'Queues',
                pt: 'Filas',
              },
              items: [],
            },
          ],
        },
        {
          title: {
            en: 'Advanced',
          },
          items: [
            {
              href: '/docs/scaling',
              title: {
                en: 'Scaling',
                pt: 'Escalabilidade',
              },
              items: [],
            },
            {
              href: '/docs/best-practices',
              title: {
                en: 'Best Practices',
                pt: 'Melhores Práticas',
              },
              items: [],
            },
          ],
        },
        {
          href: '/docs/api-reference',
          title: {
            en: 'API Reference',
            pt: 'Referência da API',
          },
          items: [],
        },
        {
          href: '/docs/changelog',
          title: {
            en: 'Changelog',
            pt: 'Histórico de alterações',
          },
          items: [],
        },
      ],
    },
  ],
} as const
