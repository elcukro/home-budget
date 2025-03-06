'use client';

import { useIntl } from 'react-intl';

interface ActivityItemProps {
  title: string;
  amount: number;
  type?: string;
  date: string;
  operation: 'create' | 'update' | 'delete';
  changes?: Array<{ field: string; oldValue?: any; newValue?: any; }>;
}

const ActivityItem = (props: ActivityItemProps) => {
  const intl = useIntl();

  const activityTypeColors = {
    income: 'bg-green-500',
    expense: 'bg-red-500',
    loan: 'bg-blue-500',
    settings: 'bg-purple-500'
  };

  // Safely handle undefined type with a default value
  const type = props.type || 'settings';
  const typeKey = type.toLowerCase() as keyof typeof activityTypeColors;
  const dotColor = activityTypeColors[typeKey] || 'bg-gray-500';

  // ... rest of the component code ...
};

export default ActivityItem; 