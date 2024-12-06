import useSWR from 'swr';
import axios from 'axios';
import { QueueMetrics } from '../types';

const fetcher = (url: string) => axios.get(url).then(res => res.data);

export function useQueueMetrics() {
  const { data, error, isLoading } = useSWR<{ metrics: QueueMetrics }>('/api/queues/metrics', fetcher);

  return {
    metrics: data?.metrics,
    isLoading,
    isError: error
  };
} 