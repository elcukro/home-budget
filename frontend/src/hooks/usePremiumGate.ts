import { useSubscription } from '@/contexts/SubscriptionContext';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useIntl } from 'react-intl';

interface PremiumGateOptions {
  feature: string;
  redirectToPricing?: boolean;
  showToast?: boolean;
}

export function usePremiumGate() {
  const { isPremium, isTrial, usage, subscription } = useSubscription();
  const router = useRouter();
  const { toast } = useToast();
  const intl = useIntl();

  /**
   * Check if user has premium access (either paid or trial)
   */
  const hasPremiumAccess = isPremium || isTrial;

  /**
   * Check if user can access a specific feature
   * @returns true if access is granted, false if blocked
   */
  const checkAccess = (options: PremiumGateOptions): boolean => {
    const { feature, redirectToPricing = false, showToast = true } = options;

    if (hasPremiumAccess) {
      return true;
    }

    if (showToast) {
      toast({
        title: intl.formatMessage({ id: 'premium.required.title' }, { feature }),
        description: intl.formatMessage({ id: 'premium.required.description' }),
        variant: 'destructive',
      });
    }

    if (redirectToPricing) {
      router.push('/pricing');
    }

    return false;
  };

  /**
   * Check if user can add more of a specific resource type
   */
  const canAdd = (resourceType: 'expenses' | 'incomes' | 'loans' | 'savings_goals'): { allowed: boolean; message: string } => {
    if (hasPremiumAccess) {
      return { allowed: true, message: '' };
    }

    if (!usage) {
      return { allowed: true, message: '' }; // Allow if we don't have usage data yet
    }

    const resourceUsage = usage[resourceType];
    if (resourceUsage.unlimited || resourceUsage.limit === null) {
      return { allowed: true, message: '' };
    }

    if (resourceUsage.used >= resourceUsage.limit) {
      return {
        allowed: false,
        message: intl.formatMessage(
          { id: `premium.limit.${resourceType}` },
          { used: resourceUsage.used, limit: resourceUsage.limit }
        ),
      };
    }

    return { allowed: true, message: '' };
  };

  /**
   * Check if user can use bank integration
   */
  const canUseBankIntegration = (): boolean => {
    return hasPremiumAccess;
  };

  /**
   * Check if user can use AI insights
   */
  const canUseAIInsights = (): boolean => {
    return hasPremiumAccess;
  };

  /**
   * Check if user can export in a specific format
   */
  const canExportFormat = (format: string): boolean => {
    if (hasPremiumAccess) {
      return true;
    }
    // Free tier only supports JSON
    return format.toLowerCase() === 'json';
  };

  /**
   * Get remaining items for a resource type
   */
  const getRemainingCount = (resourceType: 'expenses' | 'incomes' | 'loans' | 'savings_goals'): number | null => {
    if (hasPremiumAccess || !usage) {
      return null; // null means unlimited
    }

    const resourceUsage = usage[resourceType];
    if (resourceUsage.unlimited || resourceUsage.limit === null) {
      return null;
    }

    return Math.max(0, resourceUsage.limit - resourceUsage.used);
  };

  return {
    isPremium,
    isTrial,
    hasPremiumAccess,
    subscription,
    usage,
    checkAccess,
    canAdd,
    canUseBankIntegration,
    canUseAIInsights,
    canExportFormat,
    getRemainingCount,
  };
}
