const path = require("path");

module.exports = {
  entry: {
    index: "./src/index.ts",
  },
  target: "node",
  mode: process.env.NODE_ENV || "development",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: path.resolve(__dirname, "tsconfig.json"),
            // Ensure webpack respects tsconfig paths
            transpileOnly: false,
          },
        },
        exclude: [/node_modules/, /examples/, /logs/],
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    // Ensure webpack resolves from the project root
    modules: [path.resolve(__dirname, "src"), "node_modules"],
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
    libraryTarget: "commonjs2",
    clean: true, // Add this to clean the dist folder before each build
  },
  externals: {
    fastify: "fastify",
    bullmq: "bullmq",
    ioredis: "ioredis",
    winston: "winston",
    "node-cron": "node-cron",
  },
};
