var jsc = require("./../jsc");
require("./../utils");

jsc.Optimizers = jsc.Optimizers || {};

/**
 * Constant folding optimizer.
 *
 * Example:
 *
 *   var x = 2;
 *   var y = 4;
 *   var z = x + y;
 *
 *   ---------------------
 *
 *   var x = 2;
 *   var y = 4;
 *   var z = 6;
 *
 */

Object.extend(jsc.Optimizers, {
	ConstantFolding: function(astNode) {
		console.log("CONSTANT FOLDING");
	}
});

module.exports = jsc.Optimizers.ConstantFolding;