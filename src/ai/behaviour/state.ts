class StateTableRow<T = unknown, StateT extends string | number = string> {
	constructor(
		public readonly initialState: StateT,
		public readonly condition: (this: T) => void,
		public readonly finalState: StateT,
		public readonly onStateChanged?: (this: T) => void
	) {}
}

class StateTable<StateT extends string | number = string, T = unknown> {
	private readonly states: StateTableRow<T, StateT>[] = [];
	constructor(private readonly context: T) {}

	addState(
		initialState: StateT,
		condition: (this: T) => void,
		finalState: StateT,
		onStateChanged?: (this: T) => void
	) {
		this.states.push(new StateTableRow(initialState, condition, finalState, onStateChanged));
	}

	addStates(
		initialStates: StateT[],
		condition: (this: T) => void,
		finalState: StateT,
		onStateChanged?: (this: T) => void
	) {
		this.states.push(
			...initialStates.map(state => new StateTableRow(state, condition, finalState, onStateChanged))
		);
	}

	getNextState(current: StateT) {
		const row = this.states
			.filter(x => x.initialState === current)
			.find(x => x.condition.call(this.context));
		if (row) {
			if (row.onStateChanged) {
				row.onStateChanged.call(this.context);
			}
			return row.finalState;
		}
		return current;
	}
}

export { StateTable };
