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
		const toPursuer = new Vector2(this.pursuer.x - this.owner.x, this.pursuer.y - this.owner.y);

		if (isNaN(toPursuer.x)) return new Vector2(0, 0);

		const x = Math.abs(toPursuer.x) < 1 ? 0 : -Math.sign(toPursuer.x);
		const y = Math.abs(toPursuer.y) < 1 ? 0 : -Math.sign(toPursuer.y);

		return new Vector2(x, y);
	}
}
