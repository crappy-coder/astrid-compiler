var jsc = require("./jsc");

/** @class */
jsc.VariableEnvironment = Object.define({
	initialize: function() {
		this.entries = new jsc.Utils.HashMap();
		this.isEverythingCaptured = false;
	},

	get count() {
		return this.entries.length;
	},

	get hasCaptures() {
		if(this.isEverythingCaptured)
			return (this.count > 0);

		var result = false;

		this.forEach(function(k, e) {
			if(e.isCaptured)
			{
				result = true;
				return false;
			}
		}, this);

		return result;
	},

	add: function(name) {
		return this.entries.set(name, new jsc.VariableEnvironment.Entry());
	},

	get: function(name) {
		return this.entries.get(name);
	},

	remove: function(name) {
		return this.entries.remove(name);
	},

	contains: function(name) {
		return this.entries.exists(name);
	},

	forEach: function(fn/*(key, entry)*/, thisArg) {
		var keys = this.entries.keys;

		for(var i = 0; i < keys.length; i++)
		{
			var k = keys[i];

			if(fn.call(thisArg, k, this.entries.get(k)) === false)
				break;
		}
	},

	captures: function(name) {
		if(this.isEverythingCaptured)
			return true;

		var e = this.get(name);

		if(!e)
			return false;

		return e.isCaptured;
	},

	setIsCaptured: function(name) {
		var e = this.get(name);

		if(!e)
			throw new Error("Variable '" + name + "' is not defined.");

		e.isCaptured = true;
	},

	setIsCapturedIfDefined: function(name) {
		var e = this.get(name);

		if(e)
			e.isCaptured = true;
	},

	setIsCapturedAll: function() {
		if(this.isEverythingCaptured)
			return;

		this.isEverythingCaptured = true;
		this.forEach(function(k, e) {
			e.isCaptured = true;
		});
	},

	setIsImported: function(name) {
		var e = this.get(name);

		if(!e)
			throw new Error("Variable '" + name + "' is not defined.");

		e.isImported = true;
	},

	setIsExported: function(name) {
		var e = this.get(name);

		if(!e)
			throw new Error("Variable '" + name + "' is not defined.");

		e.isExported = true;
	},

	clone: function() {
		var obj = new jsc.VariableEnvironment();
		this.entries.copyTo(obj.entries);
		obj.isEverythingCaptured = this.isEverythingCaptured;

		return obj;
	}
});

Object.extend(jsc.VariableEnvironment, {
	EmptyInstance: null,

	get Empty() {
		if(!jsc.VariableEnvironment.EmptyInstance)
			jsc.VariableEnvironment.EmptyInstance = new jsc.VariableEnvironment();

		return jsc.VariableEnvironment.EmptyInstance;
	}
});

/** @class */
jsc.VariableEnvironment.Entry = Object.define({
	initialize: function() {
		this.traits = jsc.VariableEnvironment.Entry.Traits.NONE;
	},

	get isCaptured() {
		return !!(this.traits & jsc.VariableEnvironment.Entry.Traits.CAPTURED);
	},
	set isCaptured(value) {
		this.traits = (value ? (this.traits | jsc.VariableEnvironment.Entry.Traits.CAPTURED) : (this.traits & ~jsc.VariableEnvironment.Entry.Traits.CAPTURED));
	},

	get isConst() {
		return !!(this.traits & jsc.VariableEnvironment.Entry.Traits.CONST);
	},
	set isConst(value) {
		this.traits = (value ? (this.traits | jsc.VariableEnvironment.Entry.Traits.CONST) : (this.traits & ~jsc.VariableEnvironment.Entry.Traits.CONST));
	},

	get isVar() {
		return !!(this.traits & jsc.VariableEnvironment.Entry.Traits.VAR);
	},
	set isVar(value) {
		this.traits = (value ? (this.traits | jsc.VariableEnvironment.Entry.Traits.VAR) : (this.traits & ~jsc.VariableEnvironment.Entry.Traits.VAR));
	},

	get isLet() {
		return !!(this.traits & jsc.VariableEnvironment.Entry.Traits.LET);
	},
	set isLet(value) {
		this.traits = (value ? (this.traits | jsc.VariableEnvironment.Entry.Traits.LET) : (this.traits & ~jsc.VariableEnvironment.Entry.Traits.LET));
	},

	get isExported() {
		return !!(this.traits & jsc.VariableEnvironment.Entry.Traits.EXPORTED);
	},
	set isExported(value) {
		this.traits = (value ? (this.traits | jsc.VariableEnvironment.Entry.Traits.EXPORTED) : (this.traits & ~jsc.VariableEnvironment.Entry.Traits.EXPORTED));
	},

	get isImported() {
		return !!(this.traits & jsc.VariableEnvironment.Entry.Traits.IMPORTED);
	},
	set isImported(value) {
		this.traits = (value ? (this.traits | jsc.VariableEnvironment.Entry.Traits.IMPORTED) : (this.traits & ~jsc.VariableEnvironment.Entry.Traits.IMPORTED));
	},

	get isImportedNamespace() {
		return !!(this.traits & jsc.VariableEnvironment.Entry.Traits.IMPORTED_NS);
	},
	set isImportedNamespace(value) {
		this.traits = (value ? (this.traits | jsc.VariableEnvironment.Entry.Traits.IMPORTED_NS) : (this.traits & ~jsc.VariableEnvironment.Entry.Traits.IMPORTED_NS));
	}

});

Object.extend(jsc.VariableEnvironment.Entry, {
	Traits: {
		NONE: 0,
		CAPTURED: 1,
		CONST: 2,
		VAR: 4,
		LET: 8,
		EXPORTED: 16,
		IMPORTED: 32,
		IMPORTED_NS: 64
	}
});

module.exports = jsc.VariableEnvironment;
