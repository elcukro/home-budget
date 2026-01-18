'use client';

import { useState, useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Calculator, Home, Car, MapPin, Users, Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type CitySize = 'large' | 'medium' | 'small' | 'village';
type HousingType = 'rent' | 'mortgage' | 'owned' | '';

interface EstimatorInputs {
  citySize: CitySize | '';
  housingType: HousingType;
  hasCar: boolean;
  childrenCount: number;
  includePartner: boolean;
}

interface HouseholdCostEstimatorProps {
  currentHousingType: HousingType;
  currentChildrenCount: number;
  currentIncludePartner: boolean;
  onEstimateApply: (estimate: number) => void;
}

// Based on GUS (Polish Central Statistical Office) 2024 data
// Average household expenditure statistics for Poland
const BASE_COSTS = {
  // Base living costs per adult (food, hygiene, basic needs)
  adult: {
    large: 2200,    // Large city (>500k)
    medium: 1900,   // Medium city (100k-500k)
    small: 1700,    // Small city (<100k)
    village: 1500,  // Village/rural
  },
  // Additional cost per child (varies by age, using average)
  childMultiplier: 0.4, // Children typically cost 40% of adult costs
  // Housing costs (rent/mortgage payment average)
  housing: {
    rent: {
      large: 3000,
      medium: 2200,
      small: 1600,
      village: 1200,
    },
    mortgage: {
      large: 2800,
      medium: 2000,
      small: 1500,
      village: 1100,
    },
    owned: {
      large: 800,  // Utilities, maintenance, property tax
      medium: 700,
      small: 600,
      village: 500,
    },
  },
  // Car ownership monthly costs (fuel, insurance, maintenance)
  car: {
    large: 800,
    medium: 900,
    small: 1000,
    village: 1100,  // Higher in village due to more driving
  },
};

function calculateEstimate(inputs: EstimatorInputs): number {
  if (!inputs.citySize || !inputs.housingType) {
    return 0;
  }

  const citySize = inputs.citySize as CitySize;
  const housingType = inputs.housingType as 'rent' | 'mortgage' | 'owned';

  // Base cost for adults
  let total = BASE_COSTS.adult[citySize];

  // Add partner if included
  if (inputs.includePartner) {
    total += BASE_COSTS.adult[citySize] * 0.7; // Partner adds 70% (shared expenses)
  }

  // Add children costs
  if (inputs.childrenCount > 0) {
    const childCost = BASE_COSTS.adult[citySize] * BASE_COSTS.childMultiplier;
    total += childCost * inputs.childrenCount;
  }

  // Add housing costs
  total += BASE_COSTS.housing[housingType][citySize];

  // Add car costs
  if (inputs.hasCar) {
    total += BASE_COSTS.car[citySize];
  }

  // Round to nearest 100
  return Math.round(total / 100) * 100;
}

export default function HouseholdCostEstimator({
  currentHousingType,
  currentChildrenCount,
  currentIncludePartner,
  onEstimateApply,
}: HouseholdCostEstimatorProps) {
  const intl = useIntl();
  const [open, setOpen] = useState(false);
  const [inputs, setInputs] = useState<EstimatorInputs>({
    citySize: '',
    housingType: currentHousingType,
    hasCar: false,
    childrenCount: currentChildrenCount,
    includePartner: currentIncludePartner,
  });

  const estimate = useMemo(() => calculateEstimate(inputs), [inputs]);

  const handleApply = useCallback(() => {
    if (estimate > 0) {
      onEstimateApply(estimate);
      setOpen(false);
    }
  }, [estimate, onEstimateApply]);

  const isValid = inputs.citySize && inputs.housingType;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 gap-2"
        >
          <Calculator className="h-4 w-4" />
          {intl.formatMessage({ id: 'onboarding.householdEstimator.button' })}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            {intl.formatMessage({ id: 'onboarding.householdEstimator.title' })}
          </DialogTitle>
          <DialogDescription>
            {intl.formatMessage({ id: 'onboarding.householdEstimator.description' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* City Size */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4 text-secondary" />
              {intl.formatMessage({ id: 'onboarding.householdEstimator.citySize.label' })}
            </label>
            <Select
              value={inputs.citySize}
              onValueChange={(value) =>
                setInputs((prev) => ({ ...prev, citySize: value as CitySize }))
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={intl.formatMessage({
                    id: 'onboarding.householdEstimator.citySize.placeholder',
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="large">
                  {intl.formatMessage({ id: 'onboarding.householdEstimator.citySize.large' })}
                </SelectItem>
                <SelectItem value="medium">
                  {intl.formatMessage({ id: 'onboarding.householdEstimator.citySize.medium' })}
                </SelectItem>
                <SelectItem value="small">
                  {intl.formatMessage({ id: 'onboarding.householdEstimator.citySize.small' })}
                </SelectItem>
                <SelectItem value="village">
                  {intl.formatMessage({ id: 'onboarding.householdEstimator.citySize.village' })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Housing Type */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Home className="h-4 w-4 text-secondary" />
              {intl.formatMessage({ id: 'onboarding.householdEstimator.housing.label' })}
            </label>
            <Select
              value={inputs.housingType}
              onValueChange={(value) =>
                setInputs((prev) => ({ ...prev, housingType: value as HousingType }))
              }
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={intl.formatMessage({
                    id: 'onboarding.householdEstimator.housing.placeholder',
                  })}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rent">
                  {intl.formatMessage({ id: 'onboarding.householdEstimator.housing.rent' })}
                </SelectItem>
                <SelectItem value="mortgage">
                  {intl.formatMessage({ id: 'onboarding.householdEstimator.housing.mortgage' })}
                </SelectItem>
                <SelectItem value="owned">
                  {intl.formatMessage({ id: 'onboarding.householdEstimator.housing.owned' })}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Household Size */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-secondary" />
              {intl.formatMessage({ id: 'onboarding.householdEstimator.household.label' })}
            </label>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary">
                  {intl.formatMessage({ id: 'onboarding.householdEstimator.household.adults' })}
                </span>
                <span className="font-medium">{inputs.includePartner ? 2 : 1}</span>
              </div>
              {inputs.childrenCount > 0 && (
                <div className="flex justify-between mt-1">
                  <span className="text-secondary">
                    {intl.formatMessage({ id: 'onboarding.householdEstimator.household.children' })}
                  </span>
                  <span className="font-medium">{inputs.childrenCount}</span>
                </div>
              )}
            </div>
          </div>

          {/* Car Ownership */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-secondary" />
              <span className="text-sm font-medium">
                {intl.formatMessage({ id: 'onboarding.householdEstimator.car.label' })}
              </span>
            </div>
            <Switch
              checked={inputs.hasCar}
              onCheckedChange={(checked) =>
                setInputs((prev) => ({ ...prev, hasCar: checked }))
              }
            />
          </div>

          {/* Estimate Result */}
          {isValid && (
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
              <p className="text-sm text-secondary mb-1">
                {intl.formatMessage({ id: 'onboarding.householdEstimator.result.label' })}
              </p>
              <p className="text-2xl font-bold text-primary">
                {estimate.toLocaleString('pl-PL')} zł
                <span className="text-sm font-normal text-secondary ml-1">
                  {intl.formatMessage({ id: 'onboarding.householdEstimator.result.perMonth' })}
                </span>
              </p>
              <p className="text-xs text-secondary mt-2">
                {intl.formatMessage({ id: 'onboarding.householdEstimator.result.note' })}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            {intl.formatMessage({ id: 'common.cancel' })}
          </Button>
          <Button
            type="button"
            onClick={handleApply}
            disabled={!isValid}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            {intl.formatMessage({ id: 'onboarding.householdEstimator.apply' })}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
