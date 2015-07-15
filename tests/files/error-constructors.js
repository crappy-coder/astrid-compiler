/****************************************************************************
 *                          Astrid Compiler Test                             
 * --------------------------------------------------------------------------
 *
 * File: 		error-constructors.js
 * Section:		Object Construction
 *
 * This tests the various error constructors.
 *
 ****************************************************************************/
 
var e1 = EvalError;
var e2 = new EvalError();
var e3 = new EvalError("BLA");