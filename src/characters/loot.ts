import Phaser from "phaser";

export class Loot extends Phaser.Physics.Arcade.Sprite {
    constructor(scene: Phaser.Scene, x: number, y: number, texture: string | Phaser.Textures.Texture, frame?: string | number) {
        super(scene, x, y, texture, frame);
        scene.physics.world.enable(this, Phaser.Physics.Arcade.STATIC_BODY);
        scene.physics.add.existing(this, true);
        scene.add.existing(this);
    }
}