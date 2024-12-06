import useSWR from 'swr';
import axios from 'axios';
import { Task } from '../types';

const fetcher = (url: string) => axios.get(url).then(res => res.data);

export function useTasks() {
  const { data, error, isLoading } = useSWR<{ tasks: Task[] }>('/api/queues', fetcher);

  return {
    tasks: data?.tasks,
    isLoading,
    isError: error
  };
} 