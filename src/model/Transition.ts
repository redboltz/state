import { Vertex } from './Vertex';

/**
 * Common base class for the three types of transition.
 * @param TTrigger The type of the trigger event that may cause this transition to be traversed.
 * @abstract
 * @public
 */
export abstract class Transition<TTrigger = any> {
	/**
	 * The guard condition that determines if the transition should be traversed given a trigger.
	 * @internal
	 */
	guard: (trigger: TTrigger) => boolean = (trigger: TTrigger): boolean => true;

	/**
	 * The behavior to call when the transition is traversed.
	 * @internal
	 */
	actions: Array<(trigger: TTrigger) => void> = [];

	/**
	 * Creates a new instance of the TransitionBase class.
	 * @param source The source vertex of the transition.
	 * @param target The target vertex of the transition.
	 * @protected
	 */
	protected constructor(source: Vertex, public readonly target: Vertex) {
		source.outgoing.unshift(this);
	}

    /**
     * Adds behaviour to the transition to be called every time the transition is traversed.
     * @param action The behaviour to call on transition traversal.
     * @returns Returns the transition.
	 * @public
     */
	public effect(action: (trigger: TTrigger) => void): this {
		this.actions.unshift(action); // NOTE: we use unshift as the runtime iterates in reverse

		return this;
	}

	/**
	 * Adds a guard condition to the transition that determines if the transition should be traversed given a trigger.
	 * @param guard A callback predicate that takes the trigger as a parameter and returns a boolean.
     * @returns Returns the transition.
	 * @public
	 */
	public when(guard: (trigger: TTrigger) => boolean): this {
		this.guard = guard;

		return this;
	}
}