import Steering from './steering';
import Phaser from 'phaser';
import { Flee } from './flee';
import Vector2 = Phaser.Math.Vector2;
import Sprite = Phaser.Physics.Arcade.Sprite;

export class Escape implements Steering {
	constructor(private owner: Sprite, private pursuer: Sprite, public force: number) {}

	calculateImpulse() {
		const pursuerDirection = this.pursuer.body.velocity;

		const toPursuer = new Vector2(this.pursuer.x - this.owner.x, this.pursuer.y - this.owner.y);

		const ownerSpeed = this.owner.body.velocity.length();
		const pursuerSpeed = this.pursuer.body.velocity.length();
		const predictTime = toPursuer.length() / (ownerSpeed + pursuerSpeed);

		const predictVector = new Vector2(
			this.pursuer.x + predictTime * pursuerDirection.x,
			this.pursuer.y + predictTime * pursuerDirection.y
		);

		return new Flee(this.owner, predictVector, this.force).calculateImpulse();
	}
}
