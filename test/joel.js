var state = require('../lib/node/index.js'),
    assert = require('assert');

let log = [];
var logger = state.log.add(message => log.push(message));

var model = new state.State('model');
var initial = new state.PseudoState('initial', model, state.PseudoStateKind.Initial);
var a = new state.State('a', model);
var b = new state.State('b', model);
var aa = new state.State('aa', a);
var aChoice = new state.PseudoState('aChoice', a, state.PseudoStateKind.Choice);

initial.external(aa);
aa.internal().when(trigger => trigger === "stay");
aa.external(aChoice).when(trigger => trigger === "move");
aChoice.external(b);

var instance = new state.Instance('instance', model);

instance.evaluate("stay");
instance.evaluate("move");

state.log.remove(logger);

describe("test/joel.js", function () {
	it("When a regions leaves via a pseddo state, than pseudo state is left and not the last known state", function () {

		assert.equal("instance leave model.model.a.a.aChoice", log[27]);
	});
});