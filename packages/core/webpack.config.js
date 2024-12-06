const path = require('path');

module.exports = {
  entry: {
    index: './src/index.ts',
    server: './src/api/server.ts'
  },
  target: 'node',
  mode: process.env.NODE_ENV || 'development',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: [/node_modules/, /examples/, /logs/],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs2',
  },
  externals: {
    fastify: 'fastify',
    bullmq: 'bullmq',
    ioredis: 'ioredis',
    winston: 'winston',
    'node-cron': 'node-cron'
  },
};