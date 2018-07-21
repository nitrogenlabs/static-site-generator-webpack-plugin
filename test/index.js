import webpack from 'webpack';
import clean from 'rimraf';

import getSubDirsSync from './utils/get-sub-dirs-sync';
import directoryContains from './utils/directory-contains';

const successCases = getSubDirsSync(`${__dirname}/success-cases`);
const errorCases = getSubDirsSync(`${__dirname}/error-cases`);

describe('Success cases', () => {
  successCases.forEach((successCase) => {
    describe(successCase, () => {
      beforeEach((done) => {
        clean(`${__dirname}/success-cases/${successCase}/actual-output`, done);
      });

      it('generates the expected HTML files', (done) => {
        const webpackConfig = require(`./success-cases/${successCase}/webpack.config.js`);

        webpack(webpackConfig, (err, stats) => {
          if(err) {
            return done(err);
          }

          const caseDir = `${__dirname}/success-cases/${successCase}`;
          const expectedDir = `${caseDir}/expected-output/`;
          const actualDir = `${caseDir}/actual-output/`;

          directoryContains(expectedDir, actualDir, (err, result) => {
            if(err) {
              return done(err);
            }

            expect(result).toBe(true);
            done();
          });
        });
      });
    });
  });
});

describe('Error cases', () => {
  errorCases.forEach((errorCase) => {
    describe(errorCase, () => {
      beforeEach((done) => {
        clean(`${__dirname}/error-cases/${errorCase}/actual-output`, done);
      });

      it('generates the expected error', (done) => {
        const webpackConfig = require(`./error-cases/${errorCase}/webpack.config.js`);
        const expectedError = require(`./error-cases/${errorCase}/expected-error.js`);

        webpack(webpackConfig, (err, stats) => {
          const actualError = stats.compilation.errors[0].toString().split('\n')[0];
          expect(actualError).to.include(expectedError);
          done();
        });
      });
    });
  });
});
