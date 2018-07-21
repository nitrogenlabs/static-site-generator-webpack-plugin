import {StatsWriterPlugin} from 'webpack-stats-plugin';
import ejs from 'ejs';
import fs from 'fs';

import StaticSiteGeneratorPlugin from '../../../src/index';

const template = ejs.compile(fs.readFileSync(`${__dirname}/template.ejs`, 'utf-8'));
const paths = [
  '/',
  '/foo',
  '/foo/bar'
];

module.exports = {
  entry: `${__dirname}/index.js`,

  output: {
    filename: 'index.js',
    libraryTarget: 'umd',
    path: `${__dirname}/actual-output`
  },

  plugins: [
    new StaticSiteGeneratorPlugin({
      locals: {
        template
      },
      paths
    }),
    new StatsWriterPlugin() // Causes the asset's `size` method to be called
  ]
};

