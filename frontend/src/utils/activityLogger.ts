import { getSession } from 'next-auth/react';

export interface ActivityLog {
  entity_type: 'Income' | 'Expense' | 'Loan';
  operation_type: 'create' | 'update' | 'delete';
  entity_id: number;
  previous_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
}

export const logActivity = async (activity: ActivityLog): Promise<void> => {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      console.error('[ActivityLogger] Cannot log activity: User not authenticated');
      return;
    }

    // Filter out created_at and updated_at from values
    const filterTimestamps = (values?: Record<string, unknown>) => {
      if (!values) return undefined;
      const { created_at, updated_at, ...filteredValues } = values;
      return filteredValues;
    };

    const cleanActivity = {
      ...activity,
      entity_id: parseInt(String(activity.entity_id)), // Ensure entity_id is a number
      previous_values: filterTimestamps(activity.previous_values),
      new_values: filterTimestamps(activity.new_values)
    };
    
    console.log('[ActivityLogger] Starting activity log with data:', {
      activity_type: activity.entity_type,
      operation: activity.operation_type,
      entity_id: activity.entity_id,
      entity_id_type: typeof activity.entity_id,
      previous_values: cleanActivity.previous_values,
      new_values: cleanActivity.new_values
    });

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const url = `${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/activities`;
    console.log('[ActivityLogger] Making request to:', url);
    
    const requestBody = JSON.stringify(cleanActivity);
    console.log('[ActivityLogger] Request payload:', requestBody);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'http://localhost:3000'
      },
      credentials: 'include',
      body: requestBody,
    });

    console.log('[ActivityLogger] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ActivityLogger] Error response:', errorText);
      console.error('[ActivityLogger] Request that caused error:', {
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'http://localhost:3000'
        },
        body: requestBody
      });
      throw new Error('Failed to log activity');
    }

    const responseData = await response.json();
    console.log('[ActivityLogger] Success response:', responseData);
  } catch (error) {
    console.error('[ActivityLogger] Error logging activity:', error);
    console.error('[ActivityLogger] Activity data that caused error:', activity);
    // Don't throw the error - we don't want to break the main flow if activity logging fails
  }
}; 