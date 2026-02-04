import { getSession } from 'next-auth/react';
import { logger } from '@/lib/logger';

export interface ActivityLog {
  entity_type: 'Income' | 'Expense' | 'Loan' | 'Saving';
  operation_type: 'create' | 'update' | 'delete';
  entity_id: number;
  previous_values?: unknown;
  new_values?: unknown;
}

export const logActivity = async (activity: ActivityLog): Promise<void> => {
  try {
    const session = await getSession();
    if (!session?.user?.email) {
      logger.error('[ActivityLogger] Cannot log activity: User not authenticated');
      return;
    }

    // Filter out created_at and updated_at from values
    const filterTimestamps = (values?: unknown): Record<string, unknown> | undefined => {
      if (!values || typeof values !== 'object' || Array.isArray(values)) return undefined;
      const { created_at: _created_at, updated_at: _updated_at, ...filteredValues } = values as Record<string, unknown>;
      return filteredValues;
    };

    const cleanActivity = {
      ...activity,
      entity_id: parseInt(String(activity.entity_id)), // Ensure entity_id is a number
      previous_values: filterTimestamps(activity.previous_values),
      new_values: filterTimestamps(activity.new_values)
    };
    
    logger.debug('[ActivityLogger] Starting activity log with data:', {
      activity_type: activity.entity_type,
      operation: activity.operation_type,
      entity_id: activity.entity_id,
      entity_id_type: typeof activity.entity_id,
      previous_values: cleanActivity.previous_values,
      new_values: cleanActivity.new_values
    });

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const url = `${API_BASE_URL}/users/${encodeURIComponent(session.user.email)}/activities`;
    logger.debug('[ActivityLogger] Making request to:', url);
    
    const requestBody = JSON.stringify(cleanActivity);
    logger.debug('[ActivityLogger] Request payload:', requestBody);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      credentials: 'include',
      body: requestBody,
    });

    logger.debug('[ActivityLogger] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[ActivityLogger] Error response:', errorText);
      logger.error('[ActivityLogger] Request that caused error:', {
        url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: requestBody
      });
      throw new Error('Failed to log activity');
    }

    const responseData = await response.json();
    logger.debug('[ActivityLogger] Success response:', responseData);
  } catch (error) {
    logger.error('[ActivityLogger] Error logging activity:', error);
    logger.error('[ActivityLogger] Activity data that caused error:', activity);
    // Don't throw the error - we don't want to break the main flow if activity logging fails
  }
}; 
