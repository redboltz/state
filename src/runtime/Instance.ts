import * as model from '../model';
import { assert, log } from '../util';
import { IInstance, IRegion, IState, evaluate } from '../runtime';

/**
 * Represents the active state configuration of a state machine instance.
 * @remarks This is the default implementation of the IInstance class and reads/writes to the active state configuration in a transactional manner at both initilisation and each call to evaluate.
 */
export class Instance implements IInstance {
	/**
	 * The last known state of each region in the state machine instance that has been entered.
	 * @internal
	 */
	private cleanState: Record<string, model.State> = {};

	/**
	 * The last known state of each region in the state machine instance that has been entered during a transaction.
	 * @internal
	 */
	private dirtyState: Record<string, model.State> = {};

	/**
	 * The last entered vertex of each region in the state machine instance that has been entered during a transaction.
	 * @internal
	 */
	private dirtyVertex: Record<string, model.Vertex> = {};

	/**
	 * Creates an instance of the Instance class.
	 * @param name The name of the state machine instance.
	 * @param root The root element of the state machine model that this an instance of.
	 * @param activeStateConfiguration Optional JSON object used to initialise the active state configuration. The json object must have been produced by a prior call to Instance.toJSON from an instance using the same model.
	 */
	public constructor(public readonly name: string, public readonly root: model.State, activeStateConfiguration: IState | undefined = undefined) {
		assert.ok(!root.parent, () => `The state provided as the root for an instance cannot have a parent`);

		if (activeStateConfiguration) {
			this.transaction(() => this.stateFromJSON(this.root, activeStateConfiguration));
		} else {
			this.transaction(() => this.root.enter(this, false, undefined));
		}
	}

	/**
	 * Passes a trigger event to the state machine instance for evaluation.
	 * @param trigger The trigger event to evaluate.
	 * @returns Returns true if the trigger event caused a state transition.
	 */
	public evaluate(trigger: any): boolean {
		log.info(() => `${this} evaluate ${typeof trigger} trigger: ${trigger}`, log.Evaluate)

		return this.transaction(() => evaluate(this.root, this, false, trigger));
	}

	/**
	 * Performs an operation within a transactional context.
	 * @param TReturn The type of the return parameter of the transactional operation.
	 * @param operation The operation to perform within the transactional context.
	 * @returns Returns the return value from the transactional context.
	 */
	transaction<TReturn>(operation: () => TReturn): TReturn {
		try {
			// perform the operation
			const result = operation();

			// commit the transaction cache to the clean state
			for (let k = Object.keys(this.dirtyState), i = k.length; i--;) {
				this.cleanState[k[i]] = this.dirtyState[k[i]];
			}

			// return the result to the caller
			return result;
		}

		// clear the transaction cache
		finally {
			this.dirtyState = {};
			this.dirtyVertex = {};
		}
	}

	/**
	 * Updates the transactional state of a region with the last entered vertex.
	 * @param vertex The vertex set as its parents last entered vertex.
	 * @remarks This should only be called by the state machine runtime.
	 */
	public setVertex(vertex: model.Vertex): void {
		if (vertex.parent) {
			this.dirtyVertex[vertex.parent.qualifiedName] = vertex;
		}
	}

	/**
	 * Updates the transactional state of a region with the last entered state.
	 * @param state The state set as its parents last entered state.
	 * @remarks This should only be called by the state machine runtime, and implementors note, you also need to update the last entered vertex within this call.
	 */
	public setState(state: model.State): void {
		if (state.parent) {
			this.dirtyVertex[state.parent.qualifiedName] = state;
			this.dirtyState[state.parent.qualifiedName] = state;
		}
	}

	/**
	 * Returns the last known state of a given region. This is the call for the state machine runtime to use as it returns the dirty transactional state.
	 * @param region The region to get the last known state of.
	 * @returns Returns the last known region of the given state. If the state has not been entered this will return undefined.
	 */
	public getState(region: model.Region): model.State {
		return this.dirtyState[region.qualifiedName] || this.cleanState[region.qualifiedName];
	}

	/**
	 * Returns the last entered vertex to the state machine runtime.
	 * @param region The region to get the last entered vertex of.
	 * @returns Returns the last entered vertex for the given region.
	 */
	public getVertex(region: model.Region): model.Vertex {
		return this.dirtyVertex[region.qualifiedName] || this.cleanState[region.qualifiedName];
	}

	/**
	 * Returns the last known state of a given region. This is the call for application programmers to use as it returns the clean transactional state more efficently.
	 * @param region The region to get the last known state of.
	 * @returns Returns the last known region of the given state. If the state has not been entered this will return undefined.
	 */
	public getLastKnownState(region: model.Region): model.State | undefined {
		return this.cleanState[region.qualifiedName];
	}

	/**
	 * Serialize the active state configuration of the state machine instance to JSON.
	 * @param Optional starting state; defaults to the root element within the state machine model.
	 * @returns Returns the JSON representation of the active state configuration. This contains just the hierarchy of states and regions with the last known state of each region.
	 */
	toJSON(state: model.State = this.root): IState {
		return { name: state.name, children: state.children.map(region => this.regionToJSON(region)).reverse() };
	}

	/**
	 * Seriaize the active state configuration of a region to JSON.
	 * @param region The region to serialize.
	 * @returns Returns the JSON representation of the active state configuration of the region.
	 * @internal
	 */
	regionToJSON(region: model.Region): IRegion {
		let lastKnownState = this.getLastKnownState(region);

		return { name: region.name, children: region.children.filter((vertex): vertex is model.State => vertex instanceof model.State).reverse().map(state => this.toJSON(state)), lastKnownState: lastKnownState ? lastKnownState.name : undefined };
	}

	/**
	 * Reconstruct the active state configuration of a state from a json object.
	 * @param state The state to reconstruct.
	 * @param jsonState The json object holding a serialized version of the active state configuration.
	 * @internal
	 */
	stateFromJSON(state: model.State, jsonState: IState): void {
		for (const jsonRegion of jsonState.children) { // NOTE: not all regions in the model may have an entry in the JSON
			const region = state.children.filter(region => region.name === jsonRegion.name)[0];

			assert.ok(region, () => `Unable to find region ${jsonRegion.name}`)

			this.regionFromJSON(region, jsonRegion);
		}
	}

	/**
	 * Reconstruct the active state configuration of a region from a json object.
	 * @param region The region to reconstruct.
	 * @param jsonRegion The json object holding a serialized version of the active state configuration.
	 * @internal
	 */
	regionFromJSON(region: model.Region, jsonRegion: IRegion): void {
		for (const jsonState of jsonRegion.children) {
			const state = region.children.filter((vertex): vertex is model.State => vertex instanceof model.State && vertex.name === jsonState.name)[0];

			assert.ok(state, () => `Unable to find state ${jsonState.name}`);

			this.stateFromJSON(state, jsonState);

			if (state.name === jsonRegion.lastKnownState) {
				this.setState(state as model.State);
			}
		}
	}

	/**
	 * Returns the name of the state machine instance.
	 * @returns The name of the state machine instance.
	 */
	public toString(): string {
		return this.name;
	}
}