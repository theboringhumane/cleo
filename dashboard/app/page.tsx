'use client';
import { TaskList } from "@/components/TaskList"
import { QueueStats } from "@/components/QueueStats"
import { Icons } from "@/components/icons"
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-12 text-center">
                <h1 className="text-4xl font-bold tracking-tight text-white mb-4">
                    Cleo Task Queue
                </h1>
                <p className="text-lg text-gray-400">
                    Modern distributed task processing system
                </p>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <QueueStats />
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <Card className="p-6 bg-black border border-gray-800 hover:border-gray-700 transition-colors">
                    <div className="mb-4">
                        <Icons.queue className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-white">Priority Queues</h3>
                    <p className="text-sm text-gray-400">
                        Intelligent task prioritization with automatic rate limiting
                    </p>
                </Card>

                <Card className="p-6 bg-black border border-gray-800 hover:border-gray-700 transition-colors">
                    <div className="mb-4">
                        <Icons.monitor className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-white">Real-time Monitoring</h3>
                    <p className="text-sm text-gray-400">
                        Live task progress tracking and performance metrics
                    </p>
                </Card>

                <Card className="p-6 bg-black border border-gray-800 hover:border-gray-700 transition-colors">
                    <div className="mb-4">
                        <Icons.retry className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-white">Auto-retry</h3>
                    <p className="text-sm text-gray-400">
                        Automatic retry mechanism with exponential backoff
                    </p>
                </Card>
            </div>

            {/* Task List */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-semibold text-white">Recent Tasks</h2>
                    <Button variant="outline" size="sm" className="border-gray-800 hover:border-gray-700">
                        View All
                    </Button>
                </div>
                <Card className="p-6 bg-black border border-gray-800">
                    <TaskList />
                </Card>
            </div>

            {/* Trusted By Section */}
            <div className="mt-16 text-center">
                <h3 className="text-sm uppercase tracking-wider text-gray-500 mb-8">
                    Trusted by teams from around the world
                </h3>
                <div className="flex justify-center space-x-12 grayscale opacity-50">
                    {/* Add company logos here */}
                </div>
            </div>
        </div>
    )
} 