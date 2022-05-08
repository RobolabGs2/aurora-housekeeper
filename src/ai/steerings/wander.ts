import Steering from './steering';
import Phaser from 'phaser';
import Vector2 = Phaser.Math.Vector2;
import Sprite = Phaser.Physics.Arcade.Sprite;

export class Wander implements Steering {
	constructor(private owner: Sprite, public force: number) {}

	wanderDistance = 7; //желание сохранить траекторию
	wanderRadius = 11; //желание повернуть...
	wanderAngle = 0.3; //...на это количество радиан...
	angleChange = 0.7; //...+- эту величину

	calculateImpulse() {
		const circleCenter = this.owner.body.velocity.clone();
		circleCenter.normalize();
		circleCenter.scale(this.wanderDistance);

		const y = Math.round(Math.random());
		const displacement = new Vector2(0, y);
		displacement.scale(this.wanderRadius);
		displacement.setAngle(this.wanderAngle);
		this.wanderAngle += Phaser.Math.RND.normal() * this.angleChange;

		return new Vector2(circleCenter.add(displacement).normalize());
	}
}
