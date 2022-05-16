import Phaser from 'phaser';
import Vector2 = Phaser.Math.Vector2;
import Sprite = Phaser.Physics.Arcade.Sprite;
import { Escape } from './escape';

export class SaveDistance extends Escape {
	constructor(
		owner: Sprite,
		pursuer: Sprite,
		public minDistance: number,
		public maxDistance: number,
		force: number
	) {
		super(owner, pursuer, force);
	}
	static zero = new Vector2(0, 0);
	calculateImpulse() {
		if (Phaser.Math.Distance.BetweenPoints(this.owner, this.pursuer) < this.minDistance)
			return super.calculateImpulse();
		if (Phaser.Math.Distance.BetweenPoints(this.owner, this.pursuer) > this.maxDistance)
			return super.calculateImpulse().scale(-1);
		return SaveDistance.zero;
	}
}
