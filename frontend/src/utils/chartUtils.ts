import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  ArcElement,
  BarController,
  LineController,
  PieController,
  DoughnutController,
  RadarController,
  PolarAreaController,
  BubbleController,
  ScatterController,
} from 'chart.js';

/**
 * Initialize Chart.js with all commonly used controllers and elements
 * This ensures that all chart types are registered before any chart is rendered
 * Call this function early in your application lifecycle
 */
export function initializeChartJS() {
  // Register all controllers
  ChartJS.register(
    // Controllers
    BarController,
    LineController,
    PieController,
    DoughnutController,
    RadarController,
    PolarAreaController,
    BubbleController,
    ScatterController,
    
    // Elements
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    ArcElement,
    PointElement,
    
    // Plugins
    Title,
    Tooltip,
    Legend
  );
}

/**
 * Reset Chart.js registry - useful for testing or when you need to re-register
 */
export function resetChartJS() {
  ChartJS.unregister(
    BarController,
    LineController,
    PieController,
    DoughnutController,
    RadarController,
    PolarAreaController,
    BubbleController,
    ScatterController,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    ArcElement,
    PointElement,
    Title,
    Tooltip,
    Legend
  );
} 