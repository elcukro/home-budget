import { ReactNode } from 'react';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

interface TooltipProps {
  content: string;
  children?: ReactNode;
  icon?: boolean;
}

export default function Tooltip({ content, children, icon = false }: TooltipProps) {
  if (icon) {
    return (
      <div className="group relative inline-block">
        <QuestionMarkCircleIcon className="ml-1 inline-block h-4 w-4 cursor-help text-subtle transition-colors group-hover:text-primary" />
        <div className="absolute left-full top-1/2 ml-2 -translate-y-1/2 rounded border border-emerald-200 bg-emerald-50 py-1 px-2 text-xs text-emerald-900 whitespace-nowrap opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
          {content}
          <div
            className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 border-4 border-transparent"
            style={{ borderRightColor: "#bbf7d0" }}
          ></div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative inline-block">
      {children}
      <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 rounded border border-emerald-200 bg-emerald-50 py-1 px-2 text-xs text-emerald-900 whitespace-nowrap opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
        {content}
        <div
          className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent"
          style={{ borderTopColor: "#bbf7d0" }}
        ></div>
      </div>
    </div>
  );
}
