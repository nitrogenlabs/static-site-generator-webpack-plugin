function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

import evaluate from 'eval';
import cheerio from 'cheerio';
import isArray from 'lodash/isArray';
import isEmpty from 'lodash/isEmpty';
import isPlainObject from 'lodash/isPlainObject';
import path from 'path';
import url from 'url';
import RawSource from 'webpack-sources/lib/RawSource';
var defaultOptions = {
  crawl: true,
  entry: '',
  globals: [],
  locals: [],
  paths: ['/']
};
export var StaticSitePlugin =
/*#__PURE__*/
function () {
  function StaticSitePlugin() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, StaticSitePlugin);

    if (isPlainObject(options)) {
      this.options = _objectSpread({}, defaultOptions, options);
    } else {
      throw new Error('StaticSitePlugin Error: "options" must be an object');
    }
  }

  _createClass(StaticSitePlugin, [{
    key: "apply",
    value: function apply(compiler) {
      var _this = this;

      compiler.hooks.emit.tapPromise('afterCompile', function (compilation) {
        var webpackStats = compilation.getStats();
        var webpackStatsJson = webpackStats.toJson();
        var _this$options = _this.options,
            crawl = _this$options.crawl,
            entry = _this$options.entry,
            globals = _this$options.globals,
            locals = _this$options.locals,
            paths = _this$options.paths;

        try {
          var asset = StaticSitePlugin.findAsset(entry, compilation, webpackStatsJson);

          if (asset === null) {
            throw new Error("StaticSitePlugin Error: Source file not found, \"".concat(entry, "\""));
          }

          var assets = StaticSitePlugin.getAssetsFromCompilation(compilation, webpackStatsJson);
          var source = asset.source();
          var render = evaluate(source, entry, globals, true);

          if (render.hasOwnProperty('default')) {
            render = render.default;
          }

          if (typeof render !== 'function') {
            throw new Error("StaticSitePlugin Error: Export from \"".concat(entry, "\" must be a function that returns an HTML string. Is output.libraryTarget in the configuration set to \"umd\"?"));
          }

          return StaticSitePlugin.renderPaths(crawl, locals, paths, render, assets, webpackStats, compilation);
        } catch (error) {
          return Promise.reject(error);
        }
      });
    }
  }], [{
    key: "renderPaths",
    value: function renderPaths(crawl, userLocals, paths, render, assets, webpackStats, compilation) {
      console.log('paths', paths);
      var filePaths = paths;

      if (!isArray(filePaths)) {
        filePaths = [filePaths];
      }

      var renderPromises = filePaths.map(function (outputPath) {
        var locals = _objectSpread({
          assets: assets,
          path: outputPath,
          webpackStats: webpackStats
        }, userLocals);

        console.log('render', render.hasOwnProperty('then'), render.length);
        var renderPromise;

        if (render.hasOwnProperty('then')) {
          renderPromise = render(locals);
        } else if (render.length < 2) {
          renderPromise = Promise.resolve(render(locals));
        } else {
          renderPromise = new Promise(function (resolve) {
            return render(locals, resolve);
          });
        }

        return renderPromise.then(function (output) {
          var outputByPath = isPlainObject(output) ? output : StaticSitePlugin.makeObject(outputPath, output);
          var assetGenerationPromises = Object.keys(outputByPath).map(function (key) {
            var rawSource = outputByPath[key];
            var assetName = StaticSitePlugin.pathToAssetName(key);

            if (compilation.assets[assetName]) {
              return Promise.resolve(null);
            }

            compilation.assets[assetName] = new RawSource(rawSource);

            if (crawl) {
              var relativePaths = StaticSitePlugin.relativePathsFromHtml({
                path: key,
                source: rawSource
              });
              return StaticSitePlugin.renderPaths(crawl, userLocals, relativePaths, render, assets, webpackStats, compilation);
            }

            return Promise.resolve(null);
          });
          return Promise.all(assetGenerationPromises);
        }).catch(function (err) {
          compilation.errors.push(err.stack);
        });
      });
      return Promise.all(renderPromises);
    }
  }, {
    key: "findAsset",
    value: function findAsset(src, compilation, webpackStatsJson) {
      var updatedSrc = src;

      if (isEmpty(updatedSrc)) {
        var chunkNames = Object.keys(webpackStatsJson.assetsByChunkName);
        updatedSrc = chunkNames[0];
      }

      var asset = compilation.assets[updatedSrc];

      if (asset) {
        return asset;
      }

      var chunkValue = webpackStatsJson.assetsByChunkName[updatedSrc];

      if (!chunkValue) {
        return null;
      } // Webpack outputs an array for each chunk when using sourcemaps


      if (isArray(chunkValue)) {
        // Is the main bundle always the first element?
        chunkValue = chunkValue[0];
      }

      return compilation.assets[chunkValue];
    } // Shamelessly stolen from html-webpack-plugin - Thanks @ampedandwired :)

  }, {
    key: "getAssetsFromCompilation",
    value: function getAssetsFromCompilation(compilation, webpackStatsJson) {
      var assets = {};

      for (var chunk in webpackStatsJson.assetsByChunkName) {
        var chunkValue = webpackStatsJson.assetsByChunkName[chunk]; // Webpack outputs an array for each chunk when using sourcemaps

        if (chunkValue instanceof Array) {
          // Is the main bundle always the first element?
          chunkValue = chunkValue[0];
        }

        if (compilation.options.output.publicPath) {
          chunkValue = compilation.options.output.publicPath + chunkValue;
        }

        assets[chunk] = chunkValue;
      }

      return assets;
    }
  }, {
    key: "pathToAssetName",
    value: function pathToAssetName(outputPath) {
      var outputFileName = outputPath.replace(/^(\/|\\)/, ''); // Remove leading slashes for webpack-dev-server

      if (!/\.(html?)$/i.test(outputFileName)) {
        outputFileName = path.join(outputFileName, 'index.html');
      }

      return outputFileName;
    }
  }, {
    key: "makeObject",
    value: function makeObject(key, value) {
      return _defineProperty({}, key, value);
    }
  }, {
    key: "relativePathsFromHtml",
    value: function relativePathsFromHtml(options) {
      var html = options.source,
          currentPath = options.path;
      var dom = cheerio.load(html);
      var linkHrefs = dom('a[href]').map(function (index, el) {
        return dom(el).attr('href');
      }).get();
      var iframeSrcs = dom('iframe[src]').map(function (index, el) {
        return dom(el).attr('src');
      }).get();
      return [].concat(linkHrefs).concat(iframeSrcs).map(function (href) {
        if (href.indexOf('//') === 0) {
          return null;
        }

        var parsed = url.parse(href);

        if (parsed.protocol || typeof parsed.path !== 'string') {
          return null;
        }

        return parsed.path.indexOf('/') === 0 ? parsed.path : url.resolve(currentPath, parsed.path);
      }).filter(function (href) {
        return href !== null;
      });
    }
  }]);

  return StaticSitePlugin;
}();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9pbmRleC50cyJdLCJuYW1lcyI6WyJldmFsdWF0ZSIsImNoZWVyaW8iLCJpc0FycmF5IiwiaXNFbXB0eSIsImlzUGxhaW5PYmplY3QiLCJwYXRoIiwidXJsIiwiUmF3U291cmNlIiwiZGVmYXVsdE9wdGlvbnMiLCJjcmF3bCIsImVudHJ5IiwiZ2xvYmFscyIsImxvY2FscyIsInBhdGhzIiwiU3RhdGljU2l0ZVBsdWdpbiIsIm9wdGlvbnMiLCJFcnJvciIsImNvbXBpbGVyIiwiaG9va3MiLCJlbWl0IiwidGFwUHJvbWlzZSIsImNvbXBpbGF0aW9uIiwid2VicGFja1N0YXRzIiwiZ2V0U3RhdHMiLCJ3ZWJwYWNrU3RhdHNKc29uIiwidG9Kc29uIiwiYXNzZXQiLCJmaW5kQXNzZXQiLCJhc3NldHMiLCJnZXRBc3NldHNGcm9tQ29tcGlsYXRpb24iLCJzb3VyY2UiLCJyZW5kZXIiLCJoYXNPd25Qcm9wZXJ0eSIsImRlZmF1bHQiLCJyZW5kZXJQYXRocyIsImVycm9yIiwiUHJvbWlzZSIsInJlamVjdCIsInVzZXJMb2NhbHMiLCJjb25zb2xlIiwibG9nIiwiZmlsZVBhdGhzIiwicmVuZGVyUHJvbWlzZXMiLCJtYXAiLCJvdXRwdXRQYXRoIiwibGVuZ3RoIiwicmVuZGVyUHJvbWlzZSIsInJlc29sdmUiLCJ0aGVuIiwib3V0cHV0Iiwib3V0cHV0QnlQYXRoIiwibWFrZU9iamVjdCIsImFzc2V0R2VuZXJhdGlvblByb21pc2VzIiwiT2JqZWN0Iiwia2V5cyIsImtleSIsInJhd1NvdXJjZSIsImFzc2V0TmFtZSIsInBhdGhUb0Fzc2V0TmFtZSIsInJlbGF0aXZlUGF0aHMiLCJyZWxhdGl2ZVBhdGhzRnJvbUh0bWwiLCJhbGwiLCJjYXRjaCIsImVyciIsImVycm9ycyIsInB1c2giLCJzdGFjayIsInNyYyIsInVwZGF0ZWRTcmMiLCJjaHVua05hbWVzIiwiYXNzZXRzQnlDaHVua05hbWUiLCJjaHVua1ZhbHVlIiwiY2h1bmsiLCJBcnJheSIsInB1YmxpY1BhdGgiLCJvdXRwdXRGaWxlTmFtZSIsInJlcGxhY2UiLCJ0ZXN0Iiwiam9pbiIsInZhbHVlIiwiaHRtbCIsImN1cnJlbnRQYXRoIiwiZG9tIiwibG9hZCIsImxpbmtIcmVmcyIsImluZGV4IiwiZWwiLCJhdHRyIiwiZ2V0IiwiaWZyYW1lU3JjcyIsImNvbmNhdCIsImhyZWYiLCJpbmRleE9mIiwicGFyc2VkIiwicGFyc2UiLCJwcm90b2NvbCIsImZpbHRlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUFBLE9BQU9BLFFBQVAsTUFBcUIsTUFBckI7QUFDQSxPQUFPQyxPQUFQLE1BQW9CLFNBQXBCO0FBQ0EsT0FBT0MsT0FBUCxNQUFvQixnQkFBcEI7QUFDQSxPQUFPQyxPQUFQLE1BQW9CLGdCQUFwQjtBQUNBLE9BQU9DLGFBQVAsTUFBMEIsc0JBQTFCO0FBQ0EsT0FBT0MsSUFBUCxNQUFpQixNQUFqQjtBQUNBLE9BQU9DLEdBQVAsTUFBZ0IsS0FBaEI7QUFDQSxPQUFPQyxTQUFQLE1BQXNCLCtCQUF0QjtBQUlBLElBQU1DLGlCQUFpQjtBQUNyQkMsU0FBTyxJQURjO0FBRXJCQyxTQUFPLEVBRmM7QUFHckJDLFdBQVMsRUFIWTtBQUlyQkMsVUFBUSxFQUphO0FBS3JCQyxTQUFPLENBQUMsR0FBRDtBQUxjLENBQXZCO0FBUUEsV0FBYUMsZ0JBQWI7QUFBQTtBQUFBO0FBR0UsOEJBQW1EO0FBQUEsUUFBdkNDLE9BQXVDLHVFQUFKLEVBQUk7O0FBQUE7O0FBQ2pELFFBQUdYLGNBQWNXLE9BQWQsQ0FBSCxFQUEyQjtBQUN6QixXQUFLQSxPQUFMLHFCQUFtQlAsY0FBbkIsRUFBc0NPLE9BQXRDO0FBQ0QsS0FGRCxNQUVPO0FBQ0wsWUFBTSxJQUFJQyxLQUFKLENBQVUscURBQVYsQ0FBTjtBQUNEO0FBQ0Y7O0FBVEg7QUFBQTtBQUFBLDBCQW9LUUMsUUFwS1IsRUFvS2tCO0FBQUE7O0FBQ2RBLGVBQVNDLEtBQVQsQ0FBZUMsSUFBZixDQUFvQkMsVUFBcEIsQ0FBK0IsY0FBL0IsRUFBK0MsVUFBQ0MsV0FBRCxF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QUFJLGFBQUosRUFBbUJ2QyxHQUFuQixDQUF1QixVQUFDMEMsS0FBRCxFQUFnQkMsRUFBaEI7QUFBQSxlQUF1QkosSUFBSUksRUFBSixFQUFRQyxJQUFSLENBQWEsS0FBYixDQUF2QjtBQUFBLE9BQXZCLEVBQW1FQyxHQUFuRSxFQUFuQjtBQUVBLGFBQU8sR0FDSkUsTUFESSxDQUNHTixTQURILEVBRUpNLE1BRkksQ0FFR0QsVUFGSCxFQUdKOUMsR0FISSxDQUdBLFVBQUNnRCxJQUFELEVBQWtCO0FBQ3JCLFlBQUdBLEtBQUtDLE9BQUwsQ0FBYSxJQUFiLE1BQXVCLENBQTFCLEVBQTZCO0FBQzNCLGlCQUFPLElBQVA7QUFDRDs7QUFFRCxZQUFNQyxTQUFTdkYsSUFBSXdGLEtBQUosQ0FBVUgsSUFBVixDQUFmOztBQUVBLFlBQUdFLE9BQU9FLFFBQVAsSUFBbUIsT0FBT0YsT0FBT3hGLElBQWQsS0FBdUIsUUFBN0MsRUFBdUQ7QUFDckQsaUJBQU8sSUFBUDtBQUNEOztBQUVELGVBQU93RixPQUFPeEYsSUFBUCxDQUFZdUYsT0FBWixDQUFvQixHQUFwQixNQUE2QixDQUE3QixHQUFpQ0MsT0FBT3hGLElBQXhDLEdBQStDQyxJQUFJeUMsT0FBSixDQUFZa0MsV0FBWixFQUF5QlksT0FBT3hGLElBQWhDLENBQXREO0FBQ0QsT0FmSSxFQWdCSjJGLE1BaEJJLENBZ0JHLFVBQUNMLElBQUQ7QUFBQSxlQUFVQSxTQUFTLElBQW5CO0FBQUEsT0FoQkgsQ0FBUDtBQWlCRDtBQWxLSDs7QUFBQTtBQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGV2YWx1YXRlIGZyb20gJ2V2YWwnO1xuaW1wb3J0IGNoZWVyaW8gZnJvbSAnY2hlZXJpbyc7XG5pbXBvcnQgaXNBcnJheSBmcm9tICdsb2Rhc2gvaXNBcnJheSc7XG5pbXBvcnQgaXNFbXB0eSBmcm9tICdsb2Rhc2gvaXNFbXB0eSc7XG5pbXBvcnQgaXNQbGFpbk9iamVjdCBmcm9tICdsb2Rhc2gvaXNQbGFpbk9iamVjdCc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB1cmwgZnJvbSAndXJsJztcbmltcG9ydCBSYXdTb3VyY2UgZnJvbSAnd2VicGFjay1zb3VyY2VzL2xpYi9SYXdTb3VyY2UnO1xuXG5pbXBvcnQge1N0YXRpY1NpdGVQbHVnaW5PcHRpb25zfSBmcm9tICcuL3R5cGVzL21haW4nO1xuXG5jb25zdCBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgY3Jhd2w6IHRydWUsXG4gIGVudHJ5OiAnJyxcbiAgZ2xvYmFsczogW10sXG4gIGxvY2FsczogW10sXG4gIHBhdGhzOiBbJy8nXVxufTtcblxuZXhwb3J0IGNsYXNzIFN0YXRpY1NpdGVQbHVnaW4ge1xuICBvcHRpb25zOiBTdGF0aWNTaXRlUGx1Z2luT3B0aW9ucztcblxuICBjb25zdHJ1Y3RvcihvcHRpb25zOiBTdGF0aWNTaXRlUGx1Z2luT3B0aW9ucyA9IHt9KSB7XG4gICAgaWYoaXNQbGFpbk9iamVjdChvcHRpb25zKSkge1xuICAgICAgdGhpcy5vcHRpb25zID0gey4uLmRlZmF1bHRPcHRpb25zLCAuLi5vcHRpb25zfTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdTdGF0aWNTaXRlUGx1Z2luIEVycm9yOiBcIm9wdGlvbnNcIiBtdXN0IGJlIGFuIG9iamVjdCcpO1xuICAgIH1cbiAgfVxuXG4gIHN0YXRpYyByZW5kZXJQYXRocyhcbiAgICBjcmF3bDogYm9vbGVhbixcbiAgICB1c2VyTG9jYWxzOiBzdHJpbmdbXSxcbiAgICBwYXRoczogc3RyaW5nW10sXG4gICAgcmVuZGVyLFxuICAgIGFzc2V0cyxcbiAgICB3ZWJwYWNrU3RhdHMsXG4gICAgY29tcGlsYXRpb25cbiAgKTogUHJvbWlzZTxhbnk+IHtcbiAgICBjb25zb2xlLmxvZygncGF0aHMnLCBwYXRocyk7XG4gICAgbGV0IGZpbGVQYXRoczogYW55ID0gcGF0aHM7XG5cbiAgICBpZighaXNBcnJheShmaWxlUGF0aHMpKSB7XG4gICAgICBmaWxlUGF0aHMgPSBbZmlsZVBhdGhzXTtcbiAgICB9XG5cbiAgICBjb25zdCByZW5kZXJQcm9taXNlczogUHJvbWlzZTxhbnk+W10gPSBmaWxlUGF0aHMubWFwKChvdXRwdXRQYXRoOiBzdHJpbmcpID0+IHtcbiAgICAgIGNvbnN0IGxvY2FscyA9IHthc3NldHMsIHBhdGg6IG91dHB1dFBhdGgsIHdlYnBhY2tTdGF0cywgLi4udXNlckxvY2Fsc307XG4gICAgICBjb25zb2xlLmxvZygncmVuZGVyJywgcmVuZGVyLmhhc093blByb3BlcnR5KCd0aGVuJyksIHJlbmRlci5sZW5ndGgpO1xuICAgICAgbGV0IHJlbmRlclByb21pc2U6IFByb21pc2U8YW55PjtcblxuICAgICAgaWYocmVuZGVyLmhhc093blByb3BlcnR5KCd0aGVuJykpIHtcbiAgICAgICAgcmVuZGVyUHJvbWlzZSA9IHJlbmRlcihsb2NhbHMpO1xuICAgICAgfSBlbHNlIGlmKHJlbmRlci5sZW5ndGggPCAyKSB7XG4gICAgICAgIHJlbmRlclByb21pc2UgPSBQcm9taXNlLnJlc29sdmUocmVuZGVyKGxvY2FscykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVuZGVyUHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiByZW5kZXIobG9jYWxzLCByZXNvbHZlKSk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZW5kZXJQcm9taXNlXG4gICAgICAgIC50aGVuKChvdXRwdXQpID0+IHtcbiAgICAgICAgICBjb25zdCBvdXRwdXRCeVBhdGg6IHN0cmluZyA9IGlzUGxhaW5PYmplY3Qob3V0cHV0KSA/IG91dHB1dCA6IFN0YXRpY1NpdGVQbHVnaW4ubWFrZU9iamVjdChvdXRwdXRQYXRoLCBvdXRwdXQpO1xuICAgICAgICAgIGNvbnN0IGFzc2V0R2VuZXJhdGlvblByb21pc2VzOiBQcm9taXNlPGFueT5bXSA9IE9iamVjdC5rZXlzKG91dHB1dEJ5UGF0aCkubWFwKChrZXk6IHN0cmluZykgPT4ge1xuICAgICAgICAgICAgY29uc3QgcmF3U291cmNlOiBzdHJpbmcgPSBvdXRwdXRCeVBhdGhba2V5XTtcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0TmFtZTogc3RyaW5nID0gU3RhdGljU2l0ZVBsdWdpbi5wYXRoVG9Bc3NldE5hbWUoa2V5KTtcblxuICAgICAgICAgICAgaWYoY29tcGlsYXRpb24uYXNzZXRzW2Fzc2V0TmFtZV0pIHtcbiAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShudWxsKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29tcGlsYXRpb24uYXNzZXRzW2Fzc2V0TmFtZV0gPSBuZXcgUmF3U291cmNlKHJhd1NvdXJjZSk7XG5cbiAgICAgICAgICAgIGlmKGNyYXdsKSB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlbGF0aXZlUGF0aHMgPSBTdGF0aWNTaXRlUGx1Z2luLnJlbGF0aXZlUGF0aHNGcm9tSHRtbCh7cGF0aDoga2V5LCBzb3VyY2U6IHJhd1NvdXJjZX0pO1xuXG4gICAgICAgICAgICAgIHJldHVybiBTdGF0aWNTaXRlUGx1Z2luXG4gICAgICAgICAgICAgICAgLnJlbmRlclBhdGhzKGNyYXdsLCB1c2VyTG9jYWxzLCByZWxhdGl2ZVBhdGhzLCByZW5kZXIsIGFzc2V0cywgd2VicGFja1N0YXRzLCBjb21waWxhdGlvbik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5hbGwoYXNzZXRHZW5lcmF0aW9uUHJvbWlzZXMpO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICAgIGNvbXBpbGF0aW9uLmVycm9ycy5wdXNoKGVyci5zdGFjayk7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHJlbmRlclByb21pc2VzKTtcbiAgfVxuXG4gIHN0YXRpYyBmaW5kQXNzZXQoc3JjOiBzdHJpbmcsIGNvbXBpbGF0aW9uLCB3ZWJwYWNrU3RhdHNKc29uKSB7XG4gICAgbGV0IHVwZGF0ZWRTcmM6IHN0cmluZyA9IHNyYztcblxuICAgIGlmKGlzRW1wdHkodXBkYXRlZFNyYykpIHtcbiAgICAgIGNvbnN0IGNodW5rTmFtZXMgPSBPYmplY3Qua2V5cyh3ZWJwYWNrU3RhdHNKc29uLmFzc2V0c0J5Q2h1bmtOYW1lKTtcbiAgICAgIHVwZGF0ZWRTcmMgPSBjaHVua05hbWVzWzBdO1xuICAgIH1cblxuICAgIGNvbnN0IGFzc2V0ID0gY29tcGlsYXRpb24uYXNzZXRzW3VwZGF0ZWRTcmNdO1xuXG4gICAgaWYoYXNzZXQpIHtcbiAgICAgIHJldHVybiBhc3NldDtcbiAgICB9XG5cbiAgICBsZXQgY2h1bmtWYWx1ZSA9IHdlYnBhY2tTdGF0c0pzb24uYXNzZXRzQnlDaHVua05hbWVbdXBkYXRlZFNyY107XG5cbiAgICBpZighY2h1bmtWYWx1ZSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gV2VicGFjayBvdXRwdXRzIGFuIGFycmF5IGZvciBlYWNoIGNodW5rIHdoZW4gdXNpbmcgc291cmNlbWFwc1xuICAgIGlmKGlzQXJyYXkoY2h1bmtWYWx1ZSkpIHtcbiAgICAgIC8vIElzIHRoZSBtYWluIGJ1bmRsZSBhbHdheXMgdGhlIGZpcnN0IGVsZW1lbnQ/XG4gICAgICBjaHVua1ZhbHVlID0gY2h1bmtWYWx1ZVswXTtcbiAgICB9XG5cbiAgICByZXR1cm4gY29tcGlsYXRpb24uYXNzZXRzW2NodW5rVmFsdWVdO1xuICB9XG5cbiAgLy8gU2hhbWVsZXNzbHkgc3RvbGVuIGZyb20gaHRtbC13ZWJwYWNrLXBsdWdpbiAtIFRoYW5rcyBAYW1wZWRhbmR3aXJlZCA6KVxuICBzdGF0aWMgZ2V0QXNzZXRzRnJvbUNvbXBpbGF0aW9uKGNvbXBpbGF0aW9uLCB3ZWJwYWNrU3RhdHNKc29uKSB7XG4gICAgY29uc3QgYXNzZXRzID0ge307XG5cbiAgICBmb3IoY29uc3QgY2h1bmsgaW4gd2VicGFja1N0YXRzSnNvbi5hc3NldHNCeUNodW5rTmFtZSkge1xuICAgICAgbGV0IGNodW5rVmFsdWUgPSB3ZWJwYWNrU3RhdHNKc29uLmFzc2V0c0J5Q2h1bmtOYW1lW2NodW5rXTtcblxuICAgICAgLy8gV2VicGFjayBvdXRwdXRzIGFuIGFycmF5IGZvciBlYWNoIGNodW5rIHdoZW4gdXNpbmcgc291cmNlbWFwc1xuICAgICAgaWYoY2h1bmtWYWx1ZSBpbnN0YW5jZW9mIEFycmF5KSB7XG4gICAgICAgIC8vIElzIHRoZSBtYWluIGJ1bmRsZSBhbHdheXMgdGhlIGZpcnN0IGVsZW1lbnQ/XG4gICAgICAgIGNodW5rVmFsdWUgPSBjaHVua1ZhbHVlWzBdO1xuICAgICAgfVxuXG4gICAgICBpZihjb21waWxhdGlvbi5vcHRpb25zLm91dHB1dC5wdWJsaWNQYXRoKSB7XG4gICAgICAgIGNodW5rVmFsdWUgPSBjb21waWxhdGlvbi5vcHRpb25zLm91dHB1dC5wdWJsaWNQYXRoICsgY2h1bmtWYWx1ZTtcbiAgICAgIH1cblxuICAgICAgYXNzZXRzW2NodW5rXSA9IGNodW5rVmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFzc2V0cztcbiAgfVxuXG4gIHN0YXRpYyBwYXRoVG9Bc3NldE5hbWUob3V0cHV0UGF0aDogc3RyaW5nKTogc3RyaW5nIHtcbiAgICBsZXQgb3V0cHV0RmlsZU5hbWU6IHN0cmluZyA9IG91dHB1dFBhdGgucmVwbGFjZSgvXihcXC98XFxcXCkvLCAnJyk7IC8vIFJlbW92ZSBsZWFkaW5nIHNsYXNoZXMgZm9yIHdlYnBhY2stZGV2LXNlcnZlclxuXG4gICAgaWYoIS9cXC4oaHRtbD8pJC9pLnRlc3Qob3V0cHV0RmlsZU5hbWUpKSB7XG4gICAgICBvdXRwdXRGaWxlTmFtZSA9IHBhdGguam9pbihvdXRwdXRGaWxlTmFtZSwgJ2luZGV4Lmh0bWwnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gb3V0cHV0RmlsZU5hbWU7XG4gIH1cblxuICBzdGF0aWMgbWFrZU9iamVjdChrZXk6IHN0cmluZywgdmFsdWU6IHN0cmluZykge1xuICAgIHJldHVybiB7W2tleV06IHZhbHVlfTtcbiAgfVxuXG4gIHN0YXRpYyByZWxhdGl2ZVBhdGhzRnJvbUh0bWwob3B0aW9ucykge1xuICAgIGNvbnN0IHtzb3VyY2U6IGh0bWwsIHBhdGg6IGN1cnJlbnRQYXRofSA9IG9wdGlvbnM7XG4gICAgY29uc3QgZG9tID0gY2hlZXJpby5sb2FkKGh0bWwpO1xuICAgIGNvbnN0IGxpbmtIcmVmcyA9IGRvbSgnYVtocmVmXScpLm1hcCgoaW5kZXg6IG51bWJlciwgZWwpID0+IGRvbShlbCkuYXR0cignaHJlZicpKS5nZXQoKTtcbiAgICBjb25zdCBpZnJhbWVTcmNzID0gZG9tKCdpZnJhbWVbc3JjXScpLm1hcCgoaW5kZXg6IG51bWJlciwgZWwpID0+IGRvbShlbCkuYXR0cignc3JjJykpLmdldCgpO1xuXG4gICAgcmV0dXJuIFtdXG4gICAgICAuY29uY2F0KGxpbmtIcmVmcylcbiAgICAgIC5jb25jYXQoaWZyYW1lU3JjcylcbiAgICAgIC5tYXAoKGhyZWY6IHN0cmluZykgPT4ge1xuICAgICAgICBpZihocmVmLmluZGV4T2YoJy8vJykgPT09IDApIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IHVybC5wYXJzZShocmVmKTtcblxuICAgICAgICBpZihwYXJzZWQucHJvdG9jb2wgfHwgdHlwZW9mIHBhcnNlZC5wYXRoICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHBhcnNlZC5wYXRoLmluZGV4T2YoJy8nKSA9PT0gMCA/IHBhcnNlZC5wYXRoIDogdXJsLnJlc29sdmUoY3VycmVudFBhdGgsIHBhcnNlZC5wYXRoKTtcbiAgICAgIH0pXG4gICAgICAuZmlsdGVyKChocmVmKSA9PiBocmVmICE9PSBudWxsKTtcbiAgfVxuXG4gIGFwcGx5KGNvbXBpbGVyKSB7XG4gICAgY29tcGlsZXIuaG9va3MuZW1pdC50YXBQcm9taXNlKCdhZnRlckNvbXBpbGUnLCAoY29tcGlsYXRpb24pID0+IHtcbiAgICAgIGNvbnN0IHdlYnBhY2tTdGF0cyA9IGNvbXBpbGF0aW9uLmdldFN0YXRzKCk7XG4gICAgICBjb25zdCB3ZWJwYWNrU3RhdHNKc29uID0gd2VicGFja1N0YXRzLnRvSnNvbigpO1xuICAgICAgY29uc3Qge2NyYXdsLCBlbnRyeSwgZ2xvYmFscywgbG9jYWxzLCBwYXRoc30gPSB0aGlzLm9wdGlvbnM7XG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGFzc2V0ID0gU3RhdGljU2l0ZVBsdWdpbi5maW5kQXNzZXQoZW50cnksIGNvbXBpbGF0aW9uLCB3ZWJwYWNrU3RhdHNKc29uKTtcblxuICAgICAgICBpZihhc3NldCA9PT0gbnVsbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU3RhdGljU2l0ZVBsdWdpbiBFcnJvcjogU291cmNlIGZpbGUgbm90IGZvdW5kLCBcIiR7ZW50cnl9XCJgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGFzc2V0cyA9IFN0YXRpY1NpdGVQbHVnaW4uZ2V0QXNzZXRzRnJvbUNvbXBpbGF0aW9uKGNvbXBpbGF0aW9uLCB3ZWJwYWNrU3RhdHNKc29uKTtcbiAgICAgICAgY29uc3Qgc291cmNlID0gYXNzZXQuc291cmNlKCk7XG4gICAgICAgIGxldCByZW5kZXIgPSBldmFsdWF0ZShzb3VyY2UsIGVudHJ5LCBnbG9iYWxzLCB0cnVlKTtcblxuICAgICAgICBpZihyZW5kZXIuaGFzT3duUHJvcGVydHkoJ2RlZmF1bHQnKSkge1xuICAgICAgICAgIHJlbmRlciA9IHJlbmRlci5kZWZhdWx0O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYodHlwZW9mIHJlbmRlciAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU3RhdGljU2l0ZVBsdWdpbiBFcnJvcjogRXhwb3J0IGZyb20gXCIke2VudHJ5fVwiIG11c3QgYmUgYSBmdW5jdGlvbiB0aGF0IHJldHVybnMgYW4gSFRNTCBzdHJpbmcuIElzIG91dHB1dC5saWJyYXJ5VGFyZ2V0IGluIHRoZSBjb25maWd1cmF0aW9uIHNldCB0byBcInVtZFwiP2ApO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIFN0YXRpY1NpdGVQbHVnaW4ucmVuZGVyUGF0aHMoY3Jhd2wsIGxvY2FscywgcGF0aHMsIHJlbmRlciwgYXNzZXRzLCB3ZWJwYWNrU3RhdHMsIGNvbXBpbGF0aW9uKTtcbiAgICAgIH0gY2F0Y2goZXJyb3IpIHtcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxufVxuIl19