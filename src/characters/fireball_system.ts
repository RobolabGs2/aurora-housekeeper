import CharacterFactory from "./character_factory";
import Vector2 = Phaser.Math.Vector2;

export interface FireballConfig {
    damage: number;
    cooldown: number;
    color: number;
    radius: number;
}

export class FireballSystem {
    constructor(readonly scene: Phaser.Scene, readonly factory: CharacterFactory) {
        this.particles = scene.add.particles('radialGradient');
        this.particleSize = scene.textures.getFrame('radialGradient').height;
        this.fireballsGroup = scene.physics.add.group()
        scene.physics.add.collider(this.factory.dynamicGroup, this.fireballsGroup, (b1, b2) => {
            let fireball = b1;
            let enemy = b2;
            if (this.fireballsGroup.contains(b2)) {
                fireball = b2;
                enemy = b1;
            }
            enemy.emit("damage", fireball.getData("damage"));
            fireball.destroy();
        });
    }
    private particles: Phaser.GameObjects.Particles.ParticleEmitterManager;
    private particleSize: number;
    private fireballsGroup: Phaser.Physics.Arcade.Group;
    spawnFireball<T extends { x: number, y: number }>(config: FireballConfig, from: T, direction: Vector2) {
        const scene = this.scene;
        const fireball = scene.add.circle(0, 0, config.radius, 0, 0);
        this.fireballsGroup.add(fireball);
        fireball.setDepth(4);
        fireball.setPosition(from.x, from.y);
        direction.normalize().scale(256);
        (fireball.body as Phaser.Physics.Arcade.Body).setVelocity(direction.x, direction.y);
        fireball.setData("damage", config.damage);
        const timer = scene.time.addEvent({
            delay: 2000,
            callback: fireball.destroy,
            callbackScope: fireball,
        });
        const c = Phaser.Display.Color.IntegerToColor(config.color)
        const followOffset = direction.normalize().scale(10);
        const emiterConfig: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {
            lifespan: 200,
            speed: { min: 0.5 * 100, max: 100 },
            scale: { start: 3 * config.radius / this.particleSize, end: 0 },
            follow: fireball,
            followOffset,
        }
        const emiterBackground = this.particles.createEmitter({
            ...emiterConfig,
            quantity: 4,
            blendMode: Phaser.BlendModes.NORMAL,
            tint: c.darken(3).color32,
        })
        const emiter = this.particles.createEmitter({
            ...emiterConfig,
            quantity: 8,
            blendMode: Phaser.BlendModes.ADD,
            tint: config.color,
        })
        fireball.on(Phaser.Core.Events.DESTROY, () => {
            emiter.stop();
            emiterBackground.stop();
            timer.remove();
            scene.time.addEvent({
                delay: 200,
                callback: () => { emiter.remove(); emiterBackground.remove(); },
            });
        })
    }
}