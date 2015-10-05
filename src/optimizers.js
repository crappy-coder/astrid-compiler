/**
 * Optimizers:
 *   - Peephole Optimizations (https://en.wikipedia.org/wiki/Peephole_optimization)
 *       - Constant Folding
 *       - Constant Propagation
 *       - Strength Reduction (https://en.wikipedia.org/wiki/Induction_variable)
 *       - Null Sequences
 *       - Combine Operations
 *       - Algebraic Laws
 *       - Special Case Instructions
 *   - Branch Folding
 *   - Branch Elimination
 *   - Dead Code Elimination
 *   - Function Inlining (?)
 *   - Convert Arrays to Typed Arrays
 *   - Loop Collapsing
 *   - Loop-Invariant Expression Hoisting
 *   - Loop-Invariant IF Hoisting (Unswitching)
 *   - Unroll Loops
 *   - Instruction Combining
 *   - Common Subexpression Elimination (CSE) (https://en.wikipedia.org/wiki/Common_subexpression_elimination)
 *   - Integer Multiplcation to Shift Expression (i.e. 'x * 4'  -->  'x << 2')
 *   - Integer Division to Shift Expression (i.e. 'x / 2'  -->  'x >> 1')
 *   - Integer Modulus to Shift Expression
 *   - Simplify Expressions
 *   - Value Range Optimization
 *
 */

/**
 * Examples:
 *   - Peephole Algebraic Laws / Combine Operations
 *
 *       Bitwise Not Transform (perform bitwise operation at compile time and use the result):
 *         x = ~20   ->   x = -21;0
 */

module.exports = {
	ConstantFolding: require("./optimizers/constant-folding")
};