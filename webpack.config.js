const webpack = require('webpack');
const path = require('path');
// const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = env => {
  console.log(env);
  return {
  entry: {
    'main':'./src/script.ts',
    'zotero_callback': './src/zotero_callback.ts'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  devtool: 'eval-source-map',
  plugins: [
    // new webpack.DefinePlugin({
    //   "process.env": JSON.stringify(process.env),
    // }),
    // new webpack.EnvironmentPlugin({'API_ROOT': "localhost:6000" || null})
    new Dotenv({path:`.env.${env.node_env}`}),
  ],
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: false
  },
}};