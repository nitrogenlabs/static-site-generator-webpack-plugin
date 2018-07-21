module.exports = (locals, callback) => {
  setTimeout(() => {
    callback(null, locals.template({html: `<h1>${locals.path}</h1>`}));
  }, 10);
};
