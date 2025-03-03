import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/outline';

interface TooltipProps {
  content: string;
}

export default function Tooltip({ content }: TooltipProps) {
  return (
    <Tippy content={content} placement="right" arrow={true}>
      <QuestionMarkCircleIcon className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-help ml-1 inline-block" />
    </Tippy>
  );
} 