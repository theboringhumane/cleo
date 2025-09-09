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
          href: '/docs/client-server-integration',
          title: {
            en: 'Client-Server Integration',
            pt: 'Integração Cliente-Servidor',
          },
          items: [],
        },
      ],
    },
    {
      title: {
        en: 'Core Concepts',
        pt: 'Conceitos Básicos',
      },
      items: [
        {
          href: '/docs/core-concepts#tasks',
          title: {
            en: 'Tasks & Decorators',
            pt: 'Tarefas e Decoradores',
          },
          items: [],
        },
        {
          href: '/docs/core-concepts#queue-classes',
          title: {
            en: 'Queue Classes',
            pt: 'Classes de Fila',
          },
          items: [],
        },
        {
          href: '/docs/core-concepts#groups',
          title: {
            en: 'Group Processing',
            pt: 'Processamento em Grupo',
          },
          items: [],
        },
        {
          href: '/docs/core-concepts#monitoring',
          title: {
            en: 'Monitoring & Events',
            pt: 'Monitoramento e Eventos',
          },
          items: [],
        }
      ],
    },
    {
      title: {
        en: 'Advanced Features',
        pt: 'Recursos Avançados',
      },
      items: [
        {
          href: '/docs/scaling',
          title: {
            en: 'Scaling Strategies',
            pt: 'Estratégias de Escala',
          },
          items: [
            {
              href: '/docs/scaling#vertical',
              title: {
                en: 'Vertical Scaling',
                pt: 'Escala Vertical',
              },
              items: [],
            },
            {
              href: '/docs/scaling#horizontal',
              title: {
                en: 'Horizontal Scaling',
                pt: 'Escala Horizontal',
              },
              items: [],
            },
            {
              href: '/docs/scaling#redis-cluster',
              title: {
                en: 'Redis Cluster',
                pt: 'Cluster Redis',
              },
              items: [],
            },
          ],
        },
        {
          href: '/docs/monitoring',
          title: {
            en: 'Monitoring',
            pt: 'Monitoramento',
          },
          items: [
            {
              href: '/docs/monitoring#events',
              title: {
                en: 'Event System',
                pt: 'Sistema de Eventos',
              },
              items: [],
            },
            {
              href: '/docs/monitoring#metrics',
              title: {
                en: 'Metrics & Stats',
                pt: 'Métricas e Estatísticas',
              },
              items: [],
            },
          ],
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
      title: {
        en: 'API Reference',
        pt: 'Referência da API',
      },
      items: [
        {
          href: '/docs/api-reference#configuration',
          title: {
            en: 'Configuration',
            pt: 'Configuração',
          },
          items: [],
        },
        {
          href: '/docs/api-reference#decorators',
          title: {
            en: 'Decorators',
            pt: 'Decoradores',
          },
          items: [],
        },
        {
          href: '/docs/api-reference#queue-management',
          title: {
            en: 'Queue Management',
            pt: 'Gerenciamento de Filas',
          },
          items: [],
        },
        {
          href: '/docs/api-reference#events',
          title: {
            en: 'Events & Monitoring',
            pt: 'Eventos e Monitoramento',
          },
          items: [],
        },
      ],
    },
    {
      title: {
        en: 'Resources',
        pt: 'Recursos',
      },
      items: [
        {
          href: '/docs/changelog',
          title: {
            en: 'Changelog',
            pt: 'Histórico de Alterações',
          },
          items: [],
        },
        {
          href: 'https://docs.bullmq.io',
          title: {
            en: 'BullMQ Documentation',
            pt: 'Documentação BullMQ',
          },
          external: true,
          items: [],
        },
      ],
    },
  ],
} as const
