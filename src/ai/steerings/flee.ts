import Steering from './steering';
import Phaser from 'phaser';
import Vector2 = Phaser.Math.Vector2;
import Sprite = Phaser.Physics.Arcade.Sprite;

export class Flee implements Steering {
	constructor(
		private owner: Sprite,
		private pursuer: { x: number; y: number },
		public force: number
	) {}

	calculateImpulse() {
		return Flee.impulse(this.owner, this.pursuer);
	}

	static impulse(owner: { x: number; y: number }, pursuer: { x: number; y: number }) {
		const toPursuer = new Vector2(pursuer.x - owner.x, pursuer.y - owner.y);

		if (isNaN(toPursuer.x)) return toPursuer.reset();

		const x = Math.abs(toPursuer.x) < 1 ? 0 : -Math.sign(toPursuer.x);
		const y = Math.abs(toPursuer.y) < 1 ? 0 : -Math.sign(toPursuer.y);

		return toPursuer.set(x, y);
	}
}
