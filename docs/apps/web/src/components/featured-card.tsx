import { Card } from '@/components/ui/card'
import { CodeBlock } from './code-block'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

interface FeaturedCardProps {
  icon?: ReactNode
  title?: ReactNode
  description?: ReactNode
  code?: string
  orientation?: 'horizontal' | 'vertical'
}

export function FeaturedCard({
  icon,
  title,
  description,
  code,
  orientation = 'vertical',
}: FeaturedCardProps) {
  return (
    <Card
      className={cn(
        'flex backdrop-blur-lg dark:bg-card-primary p-4 md:p-6',
        {
          'flex-col': orientation === 'vertical',
          'flex-row items-center gap-4': orientation === 'horizontal',
        }
      )}
    >
      {icon && (
        <div
          className={cn('flex items-center justify-center text-2xl', {
            'mb-2': orientation === 'vertical',
          })}
        >
          {icon}
        </div>
      )}

      <div className="space-y-2">
        {title && (
          <h3 className="font-bold">{title}</h3>
        )}

        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}

        {code && (
          <div className="mt-4">
            <CodeBlock
              language="ts"
              code={code}
              className="text-sm"
            />
          </div>
        )}
      </div>
    </Card>
  )
}
