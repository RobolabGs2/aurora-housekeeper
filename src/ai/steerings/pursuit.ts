import Steering from './steering';
import Phaser from 'phaser';
import { GoToPoint } from './go-point';
import Vector2 = Phaser.Math.Vector2;
import Sprite = Phaser.Physics.Arcade.Sprite;

export class Pursuit implements Steering {
	constructor(private owner: Sprite, private targetsrc: Sprite, public force: number) {}

	calculateImpulse() {
		const searcherDirection = this.owner.body.velocity;
		const target = {
			x: this.targetsrc.body.position.x,
			y: this.targetsrc.body.position.y,
		};
		const targetDirection = {
			x: this.targetsrc.body.velocity.x,
			y: this.targetsrc.body.velocity.y,
		};
		const toTarget = new Vector2(this.owner.x - target.x, this.owner.y - target.y);
		const relativeHeading = searcherDirection.dot(targetDirection);

		if (toTarget.dot(targetDirection) < 0 || relativeHeading > -0.95) {
			return new GoToPoint(this.owner, { x: target.x, y: target.y }, this.force).calculateImpulse();
		}

		const ownerSpeed = this.owner.body.velocity.length();
		const targetSpeed = this.targetsrc.body.velocity.length();
		const predictTime = toTarget.length() / (targetSpeed + ownerSpeed);

		target.x += predictTime * targetDirection.x;
		target.y += predictTime * targetDirection.y;

		return new GoToPoint(this.owner, { x: target.x, y: target.y }, this.force).calculateImpulse();
	}
}
