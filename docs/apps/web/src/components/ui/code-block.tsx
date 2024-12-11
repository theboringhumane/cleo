import { cn } from '@/lib/utils'
import React from 'react'

interface CodeBlockProps {
  language: string
  code: string
  showLineNumbers?: boolean
  className?: string
}

export function CodeBlock({
  language,
  code,
  showLineNumbers = false,
  className,
}: CodeBlockProps) {
  return (
    <div className={cn('relative rounded-lg bg-muted p-4', className)}>
      <pre className={cn('overflow-x-auto', {
        'pl-8': showLineNumbers,
      })}>
        {showLineNumbers && (
          <div className="absolute left-0 top-0 w-8 select-none border-r border-border">
            {code.split('\n').map((_, i) => (
              <div
                key={i}
                className="inline-block w-8 text-center text-sm text-muted-foreground"
              >
                {i + 1}
              </div>
            ))}
          </div>
        )}
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  )
} 