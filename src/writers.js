/**
 * Writers:
 *   - Writer     (Default / Base Writer, Pass-Through)
 *   - ES5Writer  (ECMAScript 5.1 Writer)
 *
 */
var jsc = require("./jsc");

module.exports = {
	Writer: require("./writers/writer"),
	ES5Writer: require("./writers/es5-writer"),

	Default: function(options) {
		return new jsc.Writers.Writer(options);
	},

	ES5: function(options) {
		return new jsc.Writers.ES5Writer(options);
	}
};