import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Activity {
  id: number;
  title: string;
  amount: number;
  type: string;
  date: string;
  operation: 'create' | 'update' | 'delete';
  changes?: Array<{ field: string; oldValue?: any; newValue?: any; }>;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userEmail = encodeURIComponent(session.user.email);

    // Fetch recent activities from all sources
    const [incomeResponse, expensesResponse, loansResponse, activitiesResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/users/${userEmail}/income`),
      fetch(`${API_BASE_URL}/users/${userEmail}/expenses`),
      fetch(`${API_BASE_URL}/users/${userEmail}/loans`),
      fetch(`${API_BASE_URL}/users/${userEmail}/activities`)
    ]);

    if (!incomeResponse.ok || !expensesResponse.ok || !loansResponse.ok || !activitiesResponse.ok) {
      throw new Error('Failed to fetch activities');
    }

    const [incomeData, expensesData, loansData, activitiesData] = await Promise.all([
      incomeResponse.json(),
      expensesResponse.json(),
      loansResponse.json(),
      activitiesResponse.json()
    ]);

    // Transform and combine all activities
    const activities = activitiesData.map((activity: any) => {
      const changes = [];
      
      // For create operations, use the new_values
      if (activity.operation_type === 'create' && activity.new_values) {
        for (const [key, value] of Object.entries(activity.new_values)) {
          if (key !== 'created_at' && key !== 'updated_at') {
            if (['amount', 'principal_amount', 'remaining_balance', 'monthly_payment', 'description', 'category'].includes(key) ||
                typeof value === 'number') {
              changes.push({ 
                field: key, 
                oldValue: null,
                newValue: value
              });
            }
          }
        }
      }
      // For update and delete operations
      else if ((activity.operation_type === 'update' && activity.previous_values && activity.new_values) ||
          (activity.operation_type === 'delete' && activity.previous_values)) {
        for (const [key, oldValue] of Object.entries(activity.previous_values)) {
          const newValue = activity.operation_type === 'update' ? activity.new_values[key] : undefined;
          if (key !== 'created_at' && key !== 'updated_at' && 
              (activity.operation_type === 'delete' || oldValue !== newValue)) {
            if (['amount', 'principal_amount', 'remaining_balance', 'monthly_payment', 'description', 'category'].includes(key) ||
                (typeof oldValue === 'number' && (activity.operation_type === 'delete' || typeof newValue === 'number'))) {
              changes.push({ 
                field: key, 
                oldValue: oldValue,
                newValue: activity.operation_type === 'delete' ? null : newValue
              });
            }
          }
        }
      }

      // Find the corresponding data from the fetched sources
      let entityData;
      if (activity.entity_type === 'Income') {
        entityData = incomeData.find((i: any) => i.id === activity.entity_id);
      } else if (activity.entity_type === 'Expense') {
        entityData = expensesData.find((e: any) => e.id === activity.entity_id);
      } else if (activity.entity_type === 'Loan') {
        entityData = loansData.find((l: any) => l.id === activity.entity_id);
      }
      
      return {
        id: activity.entity_id,
        title: activity.entity_type === 'Income' ? activity.new_values?.description || activity.previous_values?.description || entityData?.description :
              activity.entity_type === 'Expense' ? activity.new_values?.description || activity.previous_values?.description || entityData?.description :
              activity.new_values?.description || activity.previous_values?.description || entityData?.description,
        amount: activity.entity_type === 'Income' ? (activity.new_values?.amount || activity.previous_values?.amount || entityData?.amount) :
               activity.entity_type === 'Expense' ? -(activity.new_values?.amount || activity.previous_values?.amount || entityData?.amount) :
               -(activity.new_values?.monthly_payment || activity.previous_values?.monthly_payment || entityData?.monthly_payment),
        type: activity.entity_type,
        date: activity.timestamp || new Date().toISOString(),
        operation: activity.operation_type,
        changes: changes
      };
    });

    // Sort by date (most recent first) and limit to 10 items
    const sortedActivities = activities
      .sort((a: Activity, b: Activity) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    return NextResponse.json(sortedActivities);
  } catch (error) {
    console.error('[api][activities] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 