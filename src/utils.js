var jsc = jsc || {};

jsc.Utils = {

	createEnum: function(startValue, keys, destObj) {
		var obj = destObj || {};
		
		keys.forEach(function(k, i) {
			Object.defineProperty(obj, k, {
				value: startValue + i,
				enumerable: true,
				configurable: false,
				writable: false
			})
		})
		
		return obj;
	},
	
	format: function(str) {
		var utils = jsc.Utils;
		var i = 1;
		var args = arguments;
		var argsLen = args.length;
		
		var formatValue = function(value) {
			if(utils.isDate(value)) {
				return Date.prototype.toString.call(value);
			}
			else if(utils.isError(value)) {
				return Error.prototype.toString.call(value);
			}
			else if(utils.isFunction(value)) {
				return "[Function" + (value.name ? ": " + value.name : "") + "]";
			}
			else {
				return "" + value;
			}
		};
		
		
		if(!utils.isString(str)) {
			var objs = [];
			
			for(i = 0; i < argsLen; ++i) {
				objs.push(formatValue(args[i]));
			}
			
			return objs.join(" ");
		}
		
		str = String(str).replace(/%[sdijxX%]/g, function(m) {
			if(m === "%%") {
				return "%";
			}
			
			if(i >= argsLen) {
				return m;
			}
			
			switch(m) {
				case "%s":
					return String(args[i++]);
				case "%d":
					return Number(args[i++]);
				case "%i":
					return Math.floor(Number(args[i++]));
				case "%x":
					return "0x" + Number(args[i++]).toString(16);
				case "%X":
					return "0x" + Number(args[i++]).toString(16).toUpperCase();
				case "%j":
					try {
						return JSON.stringify(args[i++]);
					}
					catch(e) {
						void(e);
						return "[...]";
					}
				default:
					return m;
			}
		});
		
		for(var a = args[i]; i < argsLen; a = args[++i]) {
			str += " " + formatValue(a);
		}
		
		return str;
	},
	
	valueOrDefault: function(value, defaultValue) {
		return (jsc.Utils.isNullOrUndefined(value) ? defaultValue : value);
	},
	
	toString: function(value) {
		return Object.prototype.toString.call(value);
	},
	
	isUndefined: function(value) {
		return (value === void(0));
	},
	
	isNull: function(value, includeUndefined) {
		includeUndefined = jsc.Utils.valueOrDefault(includeUndefined, true);
		
		return (includeUndefined ? jsc.Utils.isNullOrUndefined(value) : value === null);
	},
	
	isNullOrUndefined: function(value) {
		return (value === null || jsc.Utils.isUndefined(value));
	},
	
	isStringNullOrEmpty: function(value) {
		return (jsc.Utils.isNullOrUndefined(value) || value.length === 0);
	},
	
	isArray: function(value) {
		return Array.isArray(value);
	},
	
	isBoolean: function(value) {
		return (typeof value === "boolean");
	},
	
	isDate: function(value) {
		return (jsc.Utils.isObject(value) && jsc.Utils.toString(value) === "[object Date]");
	},
	
	isError: function(value) {
		return (jsc.Utils.isObject(value) && (jsc.Utils.toString(value) === "[object Error]" || value instanceof Error));
	},
	
	isFunction: function(value) {
		return (typeof value === "function");
	},
	
	isNumber: function(value) {
		return (typeof value === "number");
	},
	
	isInteger: function(value) {
		if(Number.isInteger)
			return Number.isInteger(value);
			
		return (jsc.Utils.isNumber(value) && isFinite(value) && value > -9007199254740992 && value < 9007199254740992 && Math.floor(value) === value);
	},
	
	isObject: function(value) {
		return (typeof value === "object" && !jsc.Utils.isNull(value));
	},
	
	isString: function(value) {
		return (typeof value === "string");
	}
};


module.exports = jsc.Utils;
