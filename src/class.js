/*!
 *
 * Port of prototype.js class implementation for node.js
 *
 */

module.exports = (function(slice) {

	function create() {
		function subclass() {}

		var parent = null;
		var properties = actualArray(arguments);
		
		if (typeof properties[0] === "function")
			parent = properties.shift();
  
		function klass() {
			this.initialize.apply(this, arguments);
		}
	
		klass.superclass = parent;
		klass.subclasses = [];
		klass.__includeMembers = includeMembers;

		if (parent) {
			subclass.prototype = parent.prototype;
			klass.prototype = new subclass();
			parent.subclasses.push(klass);
		}

		for (var i = 0, length = properties.length; i < length; i++)
			klass.__includeMembers(properties[i]);

		if (!klass.prototype.initialize)
			klass.prototype.initialize = function() { };

		klass.prototype.constructor = klass;
		
		return klass;
	}
  
	function includeMembers(source) {
		var ancestor   = this.superclass && this.superclass.prototype;
		var properties = Object.keys(source);
		var length = properties.length;

		for (var i = 0; i < length; i++) {
			var property = properties[i];
			var propertyDescriptor = Object.getOwnPropertyDescriptor(source, property);
			var value = propertyDescriptor.value;

			if(ancestor && value && (typeof value === "function" && argumentNames(value)[0] === "$super")) {
				var method = value;

				/* jshint ignore:start */
				value = wrap((function(m) {
					return function() { return ancestor[m].apply(this, arguments); };
				})(property), method);
				/* jshint ignore:end */

				value.valueOf = method.valueOf.bind(method);
				value.toString = method.toString.bind(method);
				
				propertyDescriptor.value = value;
			}

			Object.defineProperty(this.prototype, property, propertyDescriptor);
		}

		return this;
	}

  
	function actualArray(iterable) {
		if (!iterable) 
			return [];
			
		if ("toArray" in Object(iterable))
			return iterable.toArray();

		var length = iterable.length || 0;
		var results = new Array(length);

		while (length--)
			results[length] = iterable[length];

		return results;
	}


	function update(array, args) {
		var arrayLength = array.length;
		var length = args.length;

		while (length--)
			array[arrayLength + length] = args[length];

		return array;
	}

	function wrap(fn, wrapper) {
		return function() {
			var a = update([fn.bind(this)], arguments);
			return wrapper.apply(this, a);
		}
	}

	function argumentNames(fn) {
		var names = fn.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/)[1]
		.replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
		.replace(/\s+/g, '').split(',');
		
		return names.length === 1 && !names[0] ? [] : names;
	}

	return {
		version: "0.1.0",
		Create: create
	};

}(Array.prototype.slice));