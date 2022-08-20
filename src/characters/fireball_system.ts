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
            const hitSound = scene.sound.add("fireballHit") as Phaser.Sound.HTML5AudioSound;
            hitSound.play();
            moveSoundInPoint(hitSound, fireball as any, this.factory.player!.x, this.factory.player!.y)
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
		const sound = scene.sound.add("fireballSound", {loop: true}) as Phaser.Sound.HTML5AudioSound;
		const soundSpawn = scene.sound.add("fireballSpawn") as Phaser.Sound.HTML5AudioSound;
        soundSpawn.play();
        moveSoundInPoint(soundSpawn, fireball, this.factory.player!.x, this.factory.player!.y);
        // sound.play();
        fireball.setData("sound", sound);

        fireball.on(Phaser.Core.Events.DESTROY, () => {
            emiter.stop();
            emiterBackground.stop();
            timer.remove();
            sound.destroy()
            soundSpawn.destroy()
            const stopSound = scene.sound.add("fireballStop") as Phaser.Sound.HTML5AudioSound;
            stopSound.play();
            moveSoundInPoint(stopSound, fireball, this.factory.player!.x, this.factory.player!.y)
            scene.time.addEvent({
                delay: 200,
                callback: () => { emiter.remove(); emiterBackground.remove(); },
            });
        })
    }

    update(dt: number) {
        const centerX = this.factory.player!.x;
        const centerY = this.factory.player!.y;
        for (let f of this.fireballsGroup.getChildren() as Phaser.GameObjects.Sprite[]) {
            const sound = f.getData("sound") as Phaser.Sound.HTML5AudioSound;
            moveSoundInPoint(sound, f, centerX, centerY);
            // const pan = -(this.scene.cameras.main.displayWidth/2 - this.scene.input.activePointer.x)/(this.scene.cameras.main.displayWidth/2);
		// this.sound.pan = pan;
        }
    }
}

function moveSoundInPoint(sound: Phaser.Sound.HTML5AudioSound, f: {x: number, y: number}, centerX: number, centerY: number) {
    const panSign = Math.sign(f.x - centerX);
    const distX = Math.abs(f.x - centerX);
    const panModule = distX < 32 ? 0 : Phaser.Math.Clamp((distX - 32) / 128, 0, 1);
    const pan = panSign * panModule * panModule;

    sound.setPan(Math.sign(pan) * pan * pan);
    const dist = Phaser.Math.Clamp(Phaser.Math.Distance.Between(centerX, centerY, f.x, f.y) / 512, 0.001, 1);
    sound.setVolume(Phaser.Math.SmoothStep((256 / dist * dist), 0, 1));
}

// function moveSoundInPoint2(f: {x: number, y: number}, center: {x: number, y: number}): Phaser.Sound. {
//     const panSign = Math.sign(f.x - centerX);
//     const distX = Math.abs(f.x - centerX);
//     const panModule = distX < 32 ? 0 : Phaser.Math.Clamp((distX - 32) / 128, 0, 1);
//     const pan = panSign * panModule * panModule;

//     sound.setPan(Math.sign(pan) * pan * pan);
//     const dist = Phaser.Math.Clamp(Phaser.Math.Distance.Between(centerX, centerY, f.x, f.y) / 512, 0.001, 1);
//     sound.setVolume(Phaser.Math.SmoothStep((256 / dist * dist), 0, 1));
// }