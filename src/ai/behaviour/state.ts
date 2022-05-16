class StateTableRow<T = unknown, StateT extends string | number = string> {
	constructor(
		public readonly initialState: StateT,
		public readonly condition: (this: T) => void,
		public readonly finalState: StateT,
		public readonly onStateChanged?: (this: T) => void
	) {}
}

class StateTable<StateT extends string | number = string, T = unknown> {
	private readonly rules: StateTableRow<T, StateT>[] = [];
	private readonly states = {} as Record<StateT, ((this: T) => void)[] | undefined>;

	constructor(readonly context: T) {}

	onStateChanged(state: StateT, listener: (this: T) => void) {
		const stateListeners = this.states[state];
		if (stateListeners === undefined) {
			this.states[state] = [listener];
			return;
		}
		stateListeners.push(listener);
	}

	addState(
		initialState: StateT,
		condition: (this: T) => void,
		finalState: StateT,
		onStateChanged?: (this: T) => void
	) {
		this.rules.push(new StateTableRow(initialState, condition, finalState, onStateChanged));
	}

	addStates(
		initialStates: StateT[],
		condition: (this: T) => void,
		finalState: StateT,
		onStateChanged?: (this: T) => void
	) {
		this.rules.push(
			...initialStates.map(state => new StateTableRow(state, condition, finalState, onStateChanged))
		);
	}

	getNextState(current: StateT, context: T = this.context) {
		const row = this.rules
			.filter(x => x.initialState === current)
			.find(x => x.condition.call(context));
		if (row) {
			this.states[row.finalState]?.forEach(l => l.call(context));
			if (row.onStateChanged) {
				row.onStateChanged.call(context);
			}
			return row.finalState;
		}
		return current;
	}

	createStateMachine(initialState: StateT, owner: T) {
		return new StateMachine<StateT, T>(this, owner, initialState);
	}
}

class StateMachine<StateT extends string | number = string, T = unknown> {
	constructor(readonly table: StateTable<StateT, T>, readonly owner: T, public state: StateT) {}
	update() {
		return (this.state = this.table.getNextState(this.state, this.owner));
	}
}

export { StateTable, StateMachine };
