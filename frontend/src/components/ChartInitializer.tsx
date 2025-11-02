'use client';

import { useEffect } from 'react';
import { initializeChartJS } from '@/utils/chartUtils';
import { logger } from '@/lib/logger';

/**
 * Component that initializes Chart.js on the client side
 * This ensures that all chart controllers are registered before any chart is rendered
 */
export default function ChartInitializer() {
  useEffect(() => {
    // Initialize Chart.js when the component mounts
    initializeChartJS();
    
    // Log that Chart.js has been initialized
    logger.debug('[ChartInitializer] Chart.js initialized with all controllers');
  }, []);

  // This component doesn't render anything
  return null;
} 
