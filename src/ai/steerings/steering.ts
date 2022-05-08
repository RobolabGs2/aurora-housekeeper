import Phaser from 'phaser';
import Vector2 = Phaser.Math.Vector2;

export default interface Steering {
	force: number;
	calculateImpulse(): Vector2;
}
