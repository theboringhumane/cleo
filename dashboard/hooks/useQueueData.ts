import useSWR from "swr";
import { QueueMetrics, Task } from "@cleo/core/src/types/interfaces";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export const useQueueData = () => {
  const { data, error } = useSWR<{ metrics: QueueMetrics; tasks: Task[] }>(
    "/api/queues",
    fetcher
  );

  return {
    data: data?.metrics,
    tasks: data?.tasks,
    isLoading: !error && !data,
    isError: error,
  };
};
