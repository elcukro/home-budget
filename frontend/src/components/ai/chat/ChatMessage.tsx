'use client';

import { AIMessage, ChartConfig } from '@/hooks/useAIChat';
import { useEffect, useRef, isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

/** Unwrap <p> wrappers that ReactMarkdown adds inside <li> for loose lists */
function unwrapParagraphs(children: ReactNode): ReactNode {
  return Array.isArray(children)
    ? children.map(child =>
        isValidElement(child) && (child as any).type === 'p'
          ? (child as any).props.children
          : child
      )
    : isValidElement(children) && (children as any).type === 'p'
      ? (children as any).props.children
      : children;
}

/** Detect if a cell value looks like a financial amount (e.g. "3 382 PLN", "-14 182", "53,2%") */
function isNumericCell(text: string): boolean {
  const cleaned = text.replace(/\s/g, '');
  return /^[+\-]?[\d\s.,]+(%|PLN|zł)?$/.test(cleaned) || /^[+\-~]?[\d\s]+[\s.,][\d]+/.test(cleaned);
}

const mdComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  h1: ({ children }) => (
    <h1 className="text-base font-bold mb-2 mt-3 first:mt-0" style={{ color: 'var(--color-primary)' }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold mb-1.5 mt-3 first:mt-0" style={{ color: 'var(--color-primary)' }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>
  ),
  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="text-sm">{unwrapParagraphs(children)}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  hr: () => <hr className="my-3" style={{ borderColor: 'var(--color-border)' }} />,
  code: ({ children }) => (
    <code className="px-1 py-0.5 rounded text-xs font-mono" style={{ backgroundColor: 'var(--color-border)' }}>
      {children}
    </code>
  ),
  // Styled financial tables — scrollable, alternating rows, right-aligned numbers
  table: ({ children }) => (
    <div className="overflow-x-auto my-3 rounded-xl" style={{ border: '1px solid var(--color-border)' }}>
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}>{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children, ...props }) => {
    // @ts-ignore — react-markdown passes rowIndex in node
    const isEven = (props as any).node?.position?.start?.line % 2 === 0;
    return (
      <tr style={{ backgroundColor: isEven ? 'var(--color-muted-bg)' : 'transparent' }}>
        {children}
      </tr>
    );
  },
  th: ({ children }) => {
    const text = String(children ?? '');
    const isNum = isNumericCell(text);
    return (
      <th
        className="px-3 py-2 text-left font-semibold"
        style={{
          color: '#fff',
          whiteSpace: isNum ? 'nowrap' : 'normal',
          maxWidth: isNum ? undefined : '160px',
          wordBreak: isNum ? undefined : 'break-word',
        }}
      >
        {children}
      </th>
    );
  },
  td: ({ children }) => {
    const text = String(children ?? '');
    const isNum = isNumericCell(text);
    return (
      <td
        className="px-3 py-2 border-t"
        style={{
          borderColor: 'var(--color-border)',
          textAlign: isNum ? 'right' : 'left',
          fontVariantNumeric: isNum ? 'tabular-nums' : undefined,
          whiteSpace: isNum ? 'nowrap' : 'normal',
          maxWidth: isNum ? undefined : '160px',
          wordBreak: isNum ? undefined : 'break-word',
          color: text.startsWith('-') ? 'hsl(var(--destructive))' : text.startsWith('+') ? 'hsl(var(--success))' : 'var(--color-text-primary)',
        }}
      >
        {children}
      </td>
    );
  },
};

function InlineChart({ config }: { config: ChartConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let destroyed = false;

    const loadChart = async () => {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      if (destroyed) return;

      if (chartRef.current) {
        chartRef.current.destroy();
      }

      const ctx = canvasRef.current!.getContext('2d');
      if (!ctx) return;

      // Panel-matched colors: mint, sand, blush, lilac, warning, teal, rose, purple, amber, cyan
      const panelColors = [
        '#6B9F91', '#C8B99A', '#D4958E', '#CDBAD6', '#E67C3F',
        '#5B8FB9', '#E8A5A5', '#9B8EC4', '#D4A853', '#5DB8C8',
      ];
      // For pie/doughnut: one color per label; for others: one color per dataset
      const isPieChart = config.chart_type === 'pie' || config.chart_type === 'doughnut';
      const sliceColors = config.labels.map((_, li) => panelColors[li % panelColors.length]);
      const datasetColors = config.datasets.map((d, i) =>
        d.color || panelColors[i % panelColors.length]
      );

      chartRef.current = new Chart(ctx, {
        type: config.chart_type,
        data: {
          labels: config.labels,
          datasets: config.datasets.map((d, i) => ({
            label: d.label,
            data: d.data,
            backgroundColor: isPieChart
              ? sliceColors          // array of colors → one per slice
              : config.chart_type === 'line'
                ? datasetColors[i] + '30'
                : datasetColors[i],
            borderColor: isPieChart ? sliceColors : datasetColors[i],
            borderWidth: config.chart_type === 'line' ? 2 : 1,
            tension: 0.4,
          })),
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: config.datasets.length > 1 },
            title: {
              display: true,
              text: config.title,
              font: { size: 13 },
              color: '#1F1C1A',
            },
          },
          scales: config.chart_type !== 'doughnut' && config.chart_type !== 'pie'
            ? {
                x: { ticks: { color: '#5E5852' }, grid: { color: '#E5DDD2' } },
                y: { ticks: { color: '#5E5852' }, grid: { color: '#E5DDD2' } },
              }
            : undefined,
        },
      });
    };

    loadChart();
    return () => {
      destroyed = true;
      chartRef.current?.destroy();
    };
  }, [config]);

  return (
    <div
      className="mt-2 rounded-xl p-3"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      <canvas ref={canvasRef} height={200} />
    </div>
  );
}

interface ChatMessageProps {
  message: AIMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="text-xs" style={{ color: 'var(--color-muted-text)' }}>Mieszko</span>
          </div>
        )}

        <div
          className="rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
          style={
            isUser
              ? {
                  backgroundColor: 'var(--color-primary)',
                  color: '#fff',
                  borderBottomRightRadius: '4px',
                }
              : {
                  backgroundColor: 'var(--color-muted-bg)',
                  color: 'var(--color-text-primary)',
                  borderBottomLeftRadius: '4px',
                  border: '1px solid var(--color-border)',
                }
          }
        >
          {message.toolStatus && (
            <div className="flex items-center gap-1.5 mb-1.5 text-xs" style={{ opacity: 0.7 }}>
              <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>{message.toolStatus}</span>
            </div>
          )}

          {message.content ? (
            isUser ? (
              <div className="whitespace-pre-wrap">{message.content}</div>
            ) : (
              <div className="markdown-body text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )
          ) : message.isStreaming && !message.toolStatus ? (
            <div className="flex gap-1 items-center h-4">
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : null}
        </div>

        {message.chartConfig && <InlineChart config={message.chartConfig} />}
      </div>
    </div>
  );
}
