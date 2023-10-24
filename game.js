class PlayGame extends Phaser.Scene {

    constructor() {
        super("PlayGame")
    }

    preload() {
        this.load.image("playerBody", "assets/tank_model_1_1_b.png")
        this.load.image("playerGun", "assets/tank_model_1_3_w1.png")

        this.load.image("enemyBody", "assets/tank_model_4_1_b.png")
        this.load.image("enemyGun", "assets/tank_model_4_3_w1.png")

        this.load.image("orphanage", "assets/orphanage.png")
        this.load.image("cloud1", "assets/cloud1.png")
        this.load.image("cloud2", "assets/cloud2.png")
        this.load.image("cloud3", "assets/cloud3.png")

        this.boom = this.load.audio("boom", "assets/sounds/boom.flac")
        this.hit = this.load.audio("hit", "assets/sounds/hit.wav")
        this.explosion = this.load.audio("explosion", "assets/sounds/explosion.wav")
    }

    create() {
        const gameOptions = {
            playerGravity: 800,
            playerSpeed: 300,
            enemySpeed: 150
        }
        
        const graphics = this.add.graphics();
        const mapWidth = game.config.width;
        const mapHeight = game.config.height;

        let playerScore = 0;
        let scoreText = this.add.text(32,96, "Score: 0", {fontSize: "48px", fill: "#000"});

        this.gameover = false;
        this.orphanageDestroyed = false;
        localStorage.setItem("orphanageDestroyed", "false")
        localStorage.setItem("playerDead", "false");
        localStorage.setItem("inLevel2", "false")
        this.playerDead = false;

        this.playerHealth = 250;
        let playerHealthText = this.add.text(32, 32, "Player Health: " + this.playerHealth, {fontSize: "48px", fill: "#900"})

        this.firingCooldown = false;
        this.nextShotAt = 0;
        this.shotDelay = 1000
        this.hasPowerUp = false;
        this.multiShot = false;
  

        this.orphanageHealth = 400;
        let orphanageHealthText = this.add.text(32, 160, "Orphanage Health: " + this.orphanageHealth, {fontSize: "48px", fill: "#900"})

        const infoText = this.add.text(1100, 400, "Repel the enemy attack!", {fontSize: "64px", fill: "000"})
        infoText.depth = 1;

        this.time.delayedCall(6000, removeText, [], this);

        function removeText() {
            infoText.setText("")
        }


        this.timer = this.time.addEvent({                       // Creating my own timer because this.time.now sucks (e.g. keeps running in the background constantly)
            delay: 999999,
            paused: false
        });

        this.nextEnemySpawn = 1500;
        this.enemySpawnRate = 1000;

        this.enemyHealth = 100;
        this.enemyNextShotAt = 0;
        this.enemyShotDelay = 1000;
        this.enemyFiringVector = new Phaser.Math.Vector2(-350, -100);

        this.tanksSpawned = 0;
        this.totalEnemies = 10;
        this.enemiesRemaining = this.totalEnemies;
        let remainingText = this.add.text(1200, 32, "Enemies remaining " + this.enemiesRemaining, {fontSize: "48px", fill: "000"});

        this.boom = this.sound.add("boom")
        this.boom.volume = 0.08;
        this.enemyBoom = this.sound.add("boom")
        this.enemyBoom.volume = 0.04;
        this.hit = this.sound.add("hit")
        this.hit.volume = 0.32;
        this.explosion = this.sound.add("explosion")
        this.explosion.volume = 0.24;

        graphics.lineStyle(185, 0x00ff00, 1);

        let linePoints = [-1200, mapHeight / 1.1, mapWidth + 1200, mapHeight / 1.1];           //Remnants of procedurally generated map, scrapped for linear level for weekly task completion

        const mapMiddleX = linePoints[2] - (linePoints[2] - linePoints[0]) / 2;
        const mapMiddleY = linePoints[3] - (linePoints[3] - linePoints[1]) / 2;

        graphics.lineBetween(linePoints[0], linePoints[1], linePoints[2], linePoints[3])

        let ground = this.physics.add.staticGroup();
        ground.add(this.add.zone(mapMiddleX, mapMiddleY, mapWidth * 4, 80))

        let barrier = this.physics.add.staticGroup();
        barrier.add(this.add.zone(mapMiddleX + 1525, 600, 50, 600))

        let orphanage = this.physics.add.staticGroup();
        orphanage.add(this.add.zone(350, 700, 400, 420))

        this.add.sprite(350, 700, "orphanage")
        .setScale(0.3)

        this.playerTank = this.physics.add.sprite(mapMiddleX, mapMiddleY - 200, "playerBody");          // Setting up player tank
        this.playerGun = this.physics.add.sprite(mapMiddleX, mapMiddleY - 200, "playerGun").setOrigin(0.6, 0.5);

        this.playerTank.setScale(0.45)
        this.playerGun.setScale(0.75)

        this.playerTank.body.setSize(200,125)
        this.playerGun.setSize(140,90)

        this.playerGun.flipX = true;

        this.playerTank.body.gravity.y = gameOptions.playerGravity;
        this.physics.add.collider(this.playerTank, ground)
        this.physics.add.collider(this.playerTank, barrier)

        this.bullets = this.add.group();
        this.enemyBullets = this.add.group();
        this.tanks = this.add.group();
        this.leftTanks = this.add.group();

        this.physics.add.overlap(this.bullets, ground, destroyBullets, null, this)
        this.physics.add.overlap(this.enemyBullets, this.playerTank, damagePlayer, null, this)
        this.physics.add.overlap(this.enemyBullets, ground, destroyBullets, null, this)

        this.physics.add.collider(orphanage, this.playerTank)

        this.cursors = this.input.keyboard.createCursorKeys();
                
        this.powerUps = this.physics.add.group();
        this.physics.add.collider(this.powerUps, ground)



        this.spawnTank = function() {
            const enemyTank = this.add.sprite(30, 35, "enemyBody");                         // Setting up enemy tanks
            const enemyGun = this.add.sprite(30, 22, "enemyGun").setOrigin(0.6, 0.5);
            const enemyCooldown = Math.random() * 1000 * 8;
            this.tanksSpawned += 1;

            enemyTank.setScale(0.45)
            enemyGun.setScale(0.75)
            enemyGun.flipX = true;
            enemyGun.rotation = Math.PI + this.enemyFiringVector.angle();

            this.enemyContainer = this.add.container(mapMiddleX + 1600, mapMiddleY - 100, [enemyTank, enemyGun]);

            this.enemyContainer.setData("Health", this.enemyHealth)
            this.enemyContainer.setData("Cooldown", enemyCooldown)
            this.enemyContainer.setData("NextShotAt", this.enemyNextShotAt)

            this.physics.world.enable(this.enemyContainer);
            this.enemyContainer.body.gravity.y = gameOptions.playerGravity;
            this.physics.add.collider(this.enemyContainer, ground)
            this.physics.add.collider(this.playerTank, this.enemyContainer)
            this.physics.add.overlap(this.enemyContainer, orphanage, tankDamageOrphanage, null, this)
            this.physics.add.overlap(this.enemyBullets, orphanage, bulletDamageOrphanage, null, this)

            this.physics.add.overlap(this.bullets, this.enemyContainer, damageTank, null, this)
            this.tanks.add(this.enemyContainer)
            // Later add overlap if playertank hits enemytank => damage? death?
        }
        this.spawnTank()


        function destroyBullets(bullet) {
            bullet.destroy()
        }

        function damageTank(bullet, enemyContainer) {                                           //Damaging enemy tanks
            this.hit.play();
            bullet.destroy();
            if(enemyContainer.data.get("Health") <= 25) {
                let powerUp;
                switch(Math.floor(Math.random() * 8 + 1)) {                                     //Powerup roll
                    case 1:
                        powerUp = this.add.circle(enemyContainer.body.x, enemyContainer.body.y + 30, 25, 0x0b03fc).setData("Type", 1);
                        this.powerUps.add(powerUp);
        
                        this.physics.add.overlap(powerUp, this.playerTank, getPowerUp, null, this);
                    break

                    case 2:
                        powerUp = this.add.circle(enemyContainer.body.x, enemyContainer.body.y + 30, 25, 0xFF0000).setData("Type", 2);
                        this.powerUps.add(powerUp);
        
                        this.physics.add.overlap(powerUp, this.playerTank, getPowerUp, null, this);
                    break
                }

                this.explosion.play()
                enemyContainer.destroy();
                playerScore += 50;
                this.enemiesRemaining -= 1;
                scoreText.setText("Score: " + playerScore);
                remainingText.setText("Enemies remaining " + this.enemiesRemaining);
                if(this.enemiesRemaining == 0) {

                    this.add.text(1000, 360, "You successfully repelled the attack!", {fontSize: "64px", fill: "000"});
                    this.add.text(1000, 424, "Head to the right to find their base!", {fontSize: "64px", fill: "000"});

                    let levelTrigger = this.physics.add.staticGroup();
                    levelTrigger.add(this.add.zone(mapMiddleX + 1500, 600, 50, 600))
                    this.physics.add.overlap(this.playerTank, levelTrigger, changeLevel, null, this)

                    function changeLevel() {
                        localStorage.setItem("playerScore", playerScore)
                        this.scene.start("Level2")
                    }
                }

            } else {
                enemyContainer.setData("Health", enemyContainer.data.get("Health") - 25)
            }
        }

        function damagePlayer(bullet) {                                                         //Damaging player tank
            if(!this.gameover) {
                this.hit.play()
                bullet.destroy()
                if(this.playerHealth <= 25) {
                    localStorage.setItem("playerScore", playerScore);
                    this.explosion.play()
                    localStorage.setItem("playerDead", "true");
                    localStorage.setItem("justDied", true)
                    this.scene.start("DeathScreen")
                } else {
                    this.playerHealth = this.playerHealth - 25;
                    playerHealthText.setText("Player Health: " + this.playerHealth);
                }
            }
        }

        function tankDamageOrphanage(enemyContainer) {                                          // Damaging the orphanage
            if(!this.gameover) {
                if(this.orphanageHealth <= 100) {
                    this.gameover = true;
                    this.orphanageDestroyed = true;
                    enemyContainer.destroy()
                    this.explosion.play()
                    localStorage.setItem("orphanageDestroyed", "true")

                    this.scene.start("DeathScreen")   
            } else {
                this.orphanageHealth = this.orphanageHealth - 100;
                this.hit.play()
                enemyContainer.destroy()
                orphanageHealthText.setText("Orphanage Health: " + this.orphanageHealth);
            }
        }
    }

        function bulletDamageOrphanage(bullet) {
            bullet.destroy()
            if(!this.gameover) {
                if(this.orphanageHealth <= 25) {
                    this.gameover = true;
                    this.orphanageDestroyed = true;
                    this.explosion.play()
                    localStorage.setItem("orphanageDestroyed", "true")

                    this.scene.start("DeathScreen")
                } else {
                    this.orphanageHealth = this.orphanageHealth - 25;
                    this.hit.play()
                    orphanageHealthText.setText("Orphanage Health: " + this.orphanageHealth);
                }
            }
            
        }




        function getPowerUp(powerUp, playerTank) {                                                  // Powerup handling
            if(powerUp.data.get("Type") == 1) {
                this.shotDelay = 200;
                this.speedUp = true;
                this.speedUpEndTime = this.currentTime + 7000;
            }
            if(powerUp.data.get("Type") == 2) {
                this.multiShot = true;
                this.multiShotEndTime = this.currentTime + 7000
            }
            powerUp.destroy();
            playerScore += 150;
            scoreText.setText("Score: " + playerScore);
        }

        this.spawnClouds = function() {
            this.add.sprite(mapMiddleX, 200, "cloud1")
            .setScale(0.5)

            this.add.sprite(mapMiddleX - 500, 250, "cloud2")
            .setScale(0.75)

            this.add.sprite(mapMiddleX + 750, 300, "cloud3")
            .setScale(0.6)
        }
        this.spawnClouds()
    }





    update() {

        this.currentTime = this.timer.getElapsedSeconds() * 1000;

        if(this.currentTime > this.nextEnemySpawn && this.totalEnemies - this.tanksSpawned > 0) {       //Spawn enemy tanks
            this.enemySpawnRate = Math.random() * 5000 + 1500
            this.nextEnemySpawn = this.nextEnemySpawn + this.enemySpawnRate;
            this.spawnTank();
        }

        if(this.enemyContainer.body) {                                                          //Move enemy tanks
            this.tanks.getChildren().forEach(enemy => {
                enemy.body.velocity.x = -gameOptions.enemySpeed * 0.7;
            })
        }

        if(!this.playerDead && !this.gameover) {
            this.playerGun.body.x = this.playerTank.body.x - 21;
            this.playerGun.body.y = this.playerTank.body.y - 20;
            
            this.mouseX = game.input.mousePointer.x;
            this.mouseY = game.input.mousePointer.y;

            let angle = Phaser.Math.Angle.Between(this.playerGun.x, this.playerGun.y, this.mouseX, this.mouseY)
            this.playerGun.rotation = angle + Math.PI;

            this.offset = new Phaser.Geom.Point(-50, -this.playerGun.height + 200);
            Phaser.Math.Rotate(this.offset, this.playerGun.rotation);
        }

        if(this.nextShotAt > this.currentTime) {                                           // Player firing cooldown timer
            this.firingCooldown = true;
        } else {
            this.firingCooldown = false;
        }


        if(!this.gameover) {                                                   
            if(this.cursors.left.isDown) {
                this.playerTank.body.velocity.x = -gameOptions.playerSpeed;                     //Player movement
                this.playerTank.flipX = false;
            }
            else if(this.cursors.right.isDown) {
                this.playerTank.body.velocity.x = gameOptions.playerSpeed;
                this.playerTank.flipX = true;
            }
            else {
                this.playerTank.body.velocity.x = 0;
            }

            if(this.cursors.up.isDown && this.playerTank.body.velocity.y == 0) {
                this.playerTank.body.velocity.y = -gameOptions.playerSpeed * 1.8;
            }

            if(this.input.mousePointer.isDown && !this.firingCooldown) {                        //Player firing
                this.bulletSpeed = 600;
    
                this.firingVector = new Phaser.Math.Vector2(this.mouseX - this.playerGun.x, this.mouseY - this.playerGun.y)
    
                this.boom.play()
                let bullet = this.add.circle(this.playerGun.x + this.offset.x, this.playerGun.y + this.offset.y, 5, "#000000");
                this.physics.add.existing(bullet);
                bullet.body.gravity.y = gameOptions.playerGravity * 0.5;
    
                this.firingVector.setLength(this.bulletSpeed)
                bullet.body.setVelocity(this.firingVector.x, this.firingVector.y)
    
                this.bullets.add(bullet)
                if(this.multiShot) {
                    bullet = this.add.circle(this.playerGun.x + this.offset.x, this.playerGun.y + this.offset.y, 5, "#000000");
                    this.physics.add.existing(bullet);
                    bullet.body.gravity.y = gameOptions.playerGravity * 0.5;
                    this.firingVector.rotate((Math.PI / 16))
                    bullet.body.setVelocity(this.firingVector.x, this.firingVector.y)
    
                    this.bullets.add(bullet)
    
                    bullet = this.add.circle(this.playerGun.x + this.offset.x, this.playerGun.y + this.offset.y, 5, "#000000");
                    this.physics.add.existing(bullet);
                    bullet.body.gravity.y = gameOptions.playerGravity * 0.5;
                    this.firingVector.rotate(-2 * Math.PI / 16)
                    bullet.body.setVelocity(this.firingVector.x, this.firingVector.y)
    
                    this.bullets.add(bullet)
                }
    
                this.nextShotAt = this.currentTime + this.shotDelay;
            }
        }
        

        
        this.tanks.getChildren().forEach(tank =>{                                               //Handle enemy tanks firing

        if(tank.data.get("NextShotAt") < this.currentTime) {
            tank.setData("Cooldown", Math.random() * 1000 * 8 + 1000)
            this.enemyNextShotAt = this.currentTime + tank.data.get("Cooldown");
            tank.setData("NextShotAt", this.enemyNextShotAt)

            let enemyBullet = this.add.circle(tank.body.x - 20, tank.body.y + 8, 5, "0x8B0000")
            this.enemyBoom.play()

            this.physics.add.existing(enemyBullet);
            enemyBullet.body.setVelocity(this.enemyFiringVector.x, this.enemyFiringVector.y)
            enemyBullet.body.gravity.y = gameOptions.playerGravity * 0.125;

            this.enemyBullets.add(enemyBullet)
            }
        })

        


        this.bullets.getChildren().forEach(bullet => {                                          // Destroy bullets out of bounds
            if(bullet.x > game.config.width + 100){
              bullet.destroy();
            }
        })

        this.enemyBullets.getChildren().forEach(bullet => {                                     // Destroy enemybullets out of bounds
            if(bullet.x > game.config.width + 300 | bullet.x < 0){
              bullet.destroy();
            }
        })

        if(this.speedUp && this.speedUpEndTime < this.currentTime) {                            // Shooting speed powerup timer
            this.shotDelay = 1000;
            this.hasSpeedUp = false;
        }

        if(this.multiShot && this.multiShotEndTime < this.currentTime) {                        // Shooting speed powerup timer
            this.multiShot = false;
        }
    }
}

class TitleScreen extends Phaser.Scene {
    constructor() {
        super("TitleScreen")
    }

    preload() {

    }

    create() {

        let graphics = this.add.graphics();

        graphics.fillStyle(0xff9933, 1);

        graphics.fillRect(1200,400,600,100);

        const playButton = this.add.text(1200,400, "Start Game")
        .setFontSize(100)
        .setInteractive();
        const self = this;
        playButton.on("pointerdown", function() {
            self.scene.start("PlayGame")
        });

        graphics.fillRect(1150, 550, 720, 100)
        const LBButton = this.add.text(1150, 550, "Leaderboards")
        .setFontSize(100)
        .setInteractive();

        LBButton.on("pointerdown", function() {
            self.scene.start("ScoreBoard")
        });
    }
}

class ScoreBoard extends Phaser.Scene {
    constructor() {
        super("ScoreBoard")
    }

    preload() {

    }

    create() {
        
        let graphics = this.add.graphics();

        graphics.fillStyle(0xff9933, 1);

        graphics.fillRect(1125,825,775,100);

        const menuButton = this.add.text(1125, 825, "Back to start")
        .setFontSize(100)
        .setInteractive();

        const self = this;
        menuButton.on("pointerdown", function() {
            self.scene.start("TitleScreen")
        });

        let justDied = localStorage.getItem("justDied")

        let score1 = parseInt(localStorage.getItem("score1"))
        let score2 = parseInt(localStorage.getItem("score2"))
        let score3 = parseInt(localStorage.getItem("score3"))

        let player1 = localStorage.getItem("player1");
        let player2 = localStorage.getItem("player2");
        let player3 = localStorage.getItem("player3");

        if(justDied === "true") {
            let playerName = localStorage.getItem("playerName");
            let playerScore = parseInt(localStorage.getItem("playerScore"));

            if((playerScore > score3 && playerScore < score2) || playerScore == score3) {       // This was a quick dirty fix because I realized too late the downfall of not using a list for score
                score3 = playerScore;
                player3 = playerName;
            } else if((playerScore > score2 && playerScore < score1) || playerScore == score2) {
                score3 = score2;
                player3 = player2
                score2 = playerScore;
                player2 = playerName;
            } else if(playerScore > score1 || playerScore == score1) {
                score3 = score2;
                player3 = player2
                score2 = score1;
                player2 = player1
                score1 = playerScore;
                player1 = playerName;
            }
        }

        localStorage.setItem("score3", score3)
        localStorage.setItem("player3", player3)
        localStorage.setItem("score2", score2)
        localStorage.setItem("player2", player2)
        localStorage.setItem("score1", score1)
        localStorage.setItem("player1", player1)

        localStorage.setItem("justDied", false)

        
        graphics.fillStyle(0xff9933, 1);

        let listX = 1000;
        let listY = 50;
        graphics.fillRect(listX,listY,1000,750);
        const text = this.add.text(listX + 200, listY + 50, "Highscores")
        .setFontSize(100);
        this.first = this.add.text(listX + 100, listY + 200, "1. " + player1 + " - " + score1)
        .setFontSize(100);
        this.second = this.add.text(listX + 100, listY + 350, "2. " + player2 + " - " + score2)
        .setFontSize(100);
        let thirdPlayer = "3. " + player3 + " - " + score3;
        this.third = this.add.text(listX + 100, listY + 500, thirdPlayer)
        .setFontSize(100);
    }
}

class DeathSreen extends Phaser.Scene {
    constructor() {
        super("DeathScreen")
    }

    create() {
        const menuX = 925;
        const menuY = 400

        const graphics = this.add.graphics();

        const playerDead = localStorage.getItem("playerDead");
        const orphanageDestroyed = localStorage.getItem("orphanageDestroyed");
    
        graphics.fillStyle(0xff9933, 1);

        if(playerDead === "true") {
            this.add.text(menuX + 10, menuY - 150, "You were destroyed!")
            .setFontSize(100);
        } else if(orphanageDestroyed === "true") {
            this.add.text(menuY + 250, menuY - 150, "The orphanage was destroyed!")
            .setFontSize(100);
        }

        graphics.fillRect(menuX,menuY,1150,100);
    
        const menuButton = this.add.text(menuX, menuY, "Return to main menu")
        .setFontSize(100)
        .setInteractive();
    
        const self = this;
        menuButton.on("pointerdown", function() {
            self.scene.start("TitleScreen")
        });
        graphics.fillRect(menuX + 180, menuY + 150, 720, 100)
    
        const LBButton = this.add.text(menuX + 180, menuY + 150, "Leaderboards")
        .setFontSize(100)
        .setInteractive();
    
        LBButton.on("pointerdown", function() {
            self.scene.start("ScoreBoard")
        });
    
        graphics.fillRect(menuX + 400, menuY + 300, 300, 100)
        const restartButton = this.add.text(menuX + 400, menuY + 300, "Retry")
        .setFontSize(100)
        .setInteractive();
    
        restartButton.on("pointerdown", function() {
            let inLevel2 = localStorage.getItem("inLevel2")
            if(inLevel2 === "false") {
                self.scene.start("PlayGame")
            } else if (inLevel2 === "true") {
                self.scene.start("Level2")
            }
        });
    }
}

class Level2 extends Phaser.Scene {
    constructor() {
        super("Level2")
    }


    preload() {
        this.load.image("playerBody", "assets/tank_model_1_1_b.png")
        this.load.image("playerGun", "assets/tank_model_1_3_w1.png")

        this.load.image("enemyBody", "assets/tank_model_4_1_b.png")
        this.load.image("enemyGun", "assets/tank_model_4_3_w1.png")

        this.load.image("cloud1", "assets/cloud1.png")
        this.load.image("cloud2", "assets/cloud2.png")
        this.load.image("cloud3", "assets/cloud3.png")

        this.load.image("enemyBase", "assets/enemybase.png")
        this.load.image("cactus", "assets/cactus.png")

        this.boom = this.load.audio("boom", "assets/sounds/boom.flac")
        this.hit = this.load.audio("hit", "assets/sounds/hit.wav")
        this.explosion = this.load.audio("explosion", "assets/sounds/explosion.wav")
    }

    create() {
        const gameOptions = {
            playerGravity: 800,
            playerSpeed: 300,
            enemySpeed: 150
        }
        
        const graphics = this.add.graphics();
        const mapWidth = game.config.width;
        const mapHeight = game.config.height;

        let playerScore = parseInt(localStorage.getItem("playerScore"));
        let scoreText = this.add.text(32,96, "Score: " + playerScore, {fontSize: "48px", fill: "#000"});

        this.gameover = false;
        localStorage.setItem("playerDead", "false");
        this.playerDead = false;
        localStorage.setItem("inLevel2", "true")

        this.playerHealth = 250;
        let playerHealthText = this.add.text(32, 32, "Player Health: " + this.playerHealth, {fontSize: "48px", fill: "#900"})

        this.firingCooldown = false;
        this.nextShotAt = 0;
        this.shotDelay = 1000
        this.hasPowerUp = false;
        this.multiShot = false;

        this.timer = this.time.addEvent({                       //Creating my own timer because this.time.now sucks (e.g. keeps running in the background constantly)
            delay: 999999,
            paused: false
        });

        const infoText = this.add.text(735, 300, "You found their base! Now destroy it!", {fontSize: "64px", fill: "000"})
        infoText.depth = 1;

        this.time.delayedCall(6000, removeText, [], this);

        function removeText() {
            infoText.setText("")
            const infoText2 = this.add.text(425, 300, "You will have to destroy the Cacti first to get closer", {fontSize: "64px", fill: "000"})
            infoText2.depth = 1;

            this.time.delayedCall(6000, removeText2, [], this);

            function removeText2() {
                infoText2.setText("")
            }

        }

        this.nextEnemySpawn = 1500;
        this.enemySpawnRate = 1000;

        this.enemyHealth = 100;
        this.enemyNextShotAt = 0;
        this.enemyShotDelay = 1000;
        this.enemyFiringVector = new Phaser.Math.Vector2(-350, -100);

        this.enemyBaseHealth = 2000;
        let enemyBaseHealthText = this.add.text(2325, 32, "Enemy base Health: " + this.enemyBaseHealth, {fontSize: "48px", fill: "#900"})

        this.cactusHealth = 250;
        this.cactus2Health = 250;

        this.boom = this.sound.add("boom")
        this.boom.volume = 0.08;
        this.enemyBoom = this.sound.add("boom")
        this.enemyBoom.volume = 0.04;
        this.hit = this.sound.add("hit")
        this.hit.volume = 0.32;
        this.explosion = this.sound.add("explosion")
        this.explosion.volume = 0.24;

        graphics.lineStyle(185, 0xff9933, 1);

        let linePoints = [-1200, mapHeight / 1.1, mapWidth + 1200, mapHeight / 1.1];           //Remnants of procedurally generated map, scrapped for linear level for weekly task completion

        const mapMiddleX = linePoints[2] - (linePoints[2] - linePoints[0]) / 2;
        const mapMiddleY = linePoints[3] - (linePoints[3] - linePoints[1]) / 2;

        graphics.lineBetween(linePoints[0], linePoints[1], linePoints[2], linePoints[3])

        let ground = this.physics.add.staticGroup();
        ground.add(this.add.zone(mapMiddleX, mapMiddleY, mapWidth * 4, 80))

        let barrier = this.physics.add.staticGroup();
        barrier.add(this.add.zone(-25, 600, 50, 600))


        this.playerTank = this.physics.add.sprite(100, mapMiddleY - 200, "playerBody");          // Setting up player tank
        this.playerGun = this.physics.add.sprite(100, mapMiddleY - 200, "playerGun").setOrigin(0.6, 0.5);

        this.playerTank.setScale(0.45)
        this.playerGun.setScale(0.75)

        this.playerTank.body.setSize(200,125)
        this.playerGun.setSize(140,90)

        this.playerGun.flipX = true;

        this.playerTank.body.gravity.y = gameOptions.playerGravity;
        this.physics.add.collider(this.playerTank, ground)
        this.physics.add.collider(this.playerTank, barrier)

        this.bullets = this.add.group();
        this.enemyBullets = this.add.group();
        this.tanks = this.add.group();
        this.leftTanks = this.add.group();

        this.physics.add.overlap(this.bullets, ground, destroyBullets, null, this)
        this.physics.add.overlap(this.enemyBullets, this.playerTank, damagePlayer, null, this)
        this.physics.add.overlap(this.enemyBullets, ground, destroyBullets, null, this)

        this.cursors = this.input.keyboard.createCursorKeys();
                
        this.powerUps = this.physics.add.group();
        this.physics.add.collider(this.powerUps, ground)

        this.add.sprite(mapMiddleX + 1300, mapMiddleY - 200, "enemyBase")
        .setScale(0.6);

        this.enemyBase = this.physics.add.staticGroup();
        this.enemyBase.add(this.add.zone(mapMiddleX + 1300, mapMiddleY - 200, 300, 300))

        this.physics.add.collider(this.playerTank, this.enemyBase)
        this.physics.add.overlap(this.bullets, this.enemyBase, damageEnemyBase, null, this)

        this.cactus = this.physics.add.staticGroup();
        this.cactusSprite = this.add.sprite(mapMiddleX - 500, mapMiddleY - 175, "cactus")
        .setScale(0.4);
        
        this.cactus.add(this.add.zone(mapMiddleX - 500, mapMiddleY - 175, 100, 300))
        this.physics.add.collider(this.playerTank, this.cactus)
        this.physics.add.overlap(this.bullets, this.cactus, damageCactus, null, this)

        this.cactus2 = this.physics.add.staticGroup();
        this.cactusSprite2 = this.add.sprite(mapMiddleX, mapMiddleY - 175, "cactus")
        .setScale(0.4)
        this.cactusSprite2.flipX = true;
        
        this.cactus2.add(this.add.zone(mapMiddleX, mapMiddleY - 175, 100, 300))
        this.physics.add.collider(this.playerTank, this.cactus2)
        this.physics.add.overlap(this.bullets, this.cactus2, damageCactus2, null, this)


        this.spawnTank = function() {
            const enemyTank = this.add.sprite(30, 35, "enemyBody");                     // Setting up enemy tanks
            const enemyGun = this.add.sprite(30, 22, "enemyGun").setOrigin(0.6, 0.5);
            const enemyCooldown = Math.random() * 1000 * 8;

            enemyTank.setScale(0.45)
            enemyGun.setScale(0.75)
            enemyGun.flipX = true;
            enemyGun.rotation = Math.PI + this.enemyFiringVector.angle();

            this.enemyContainer = this.add.container(mapMiddleX + 1270, mapMiddleY - 100, [enemyTank, enemyGun]);

            this.enemyContainer.setData("Health", this.enemyHealth)
            this.enemyContainer.setData("Cooldown", enemyCooldown)
            this.enemyContainer.setData("NextShotAt", this.enemyNextShotAt)

            this.physics.world.enable(this.enemyContainer);
            this.enemyContainer.body.gravity.y = gameOptions.playerGravity;
            this.physics.add.collider(this.enemyContainer, ground)

            this.physics.add.overlap(this.bullets, this.enemyContainer, damageTank, null, this)
            this.physics.add.collider(this.playerTank, this.enemyContainer)

            this.tanks.add(this.enemyContainer)
            // Later add overlap if playertank hits enemytank => damage? death?
        }
        this.spawnTank()


        function destroyBullets(bullet) {
            bullet.destroy()
        }

        function damageTank(bullet, enemyContainer) {                                           //Damaging enemy tanks

            this.hit.play();
            bullet.destroy();

            if(enemyContainer.data.get("Health") <= 25) {
                let powerUp;
                switch(Math.floor(Math.random() * 7 + 1)) {                                      //Powerup roll
                    case 1:
                        powerUp = this.add.circle(enemyContainer.body.x, enemyContainer.body.y + 30, 25, 0x0b03fc).setData("Type", 1);
                        this.powerUps.add(powerUp);
        
                        this.physics.add.overlap(powerUp, this.playerTank, getPowerUp, null, this);
                    break

                    case 2:
                        powerUp = this.add.circle(enemyContainer.body.x, enemyContainer.body.y + 30, 25, 0xFF0000).setData("Type", 2);
                        this.powerUps.add(powerUp);
        
                        this.physics.add.overlap(powerUp, this.playerTank, getPowerUp, null, this);
                    break
                }

                this.explosion.play()
                enemyContainer.destroy();
                playerScore += 50;
                scoreText.setText("Score: " + playerScore);

            } else {
                enemyContainer.setData("Health", enemyContainer.data.get("Health") - 25)
            }
        }

        function damagePlayer(bullet) {                                                         //Damaging player tank
            if(!this.gameover) {
                this.hit.play()
                bullet.destroy()
                if(this.playerHealth <= 25) {
                    localStorage.setItem("playerScore", playerScore);
                    this.explosion.play()
                    localStorage.setItem("playerDead", "true");
                    localStorage.setItem("justDied", true)
                    this.scene.start("DeathScreen")
                } else {
                    this.playerHealth = this.playerHealth - 25;
                    playerHealthText.setText("Player Health: " + this.playerHealth);
                }
            }
        }

        function damageEnemyBase(bullet) {                                                      // Damaging enemybase
            this.hit.play()
            bullet.destroy()
            if(this.enemyBaseHealth <= 25) {
                localStorage.setItem("playerScore", playerScore);
                this.explosion.play()
                localStorage.setItem("justDied", true)
                this.scene.start("WinScreen")
            } else {
                this.enemyBaseHealth = this.enemyBaseHealth - 25;
                enemyBaseHealthText.setText("Enemy base Health: " + this.enemyBaseHealth);
            }
        }

        function damageCactus(bullet, cactus) {                                                 // Damaging cacti
            bullet.destroy()
            if(this.cactusHealth <= 25) {
                    cactus.destroy()
                    this.cactusSprite.destroy()
            } else {
                this.cactusHealth = this.cactusHealth - 25;
            }
        }

        function damageCactus2(bullet, cactus) {
            bullet.destroy()
            if(this.cactus2Health <= 25) {
                    cactus.destroy()
                    this.cactusSprite2.destroy()
            } else {
                this.cactus2Health = this.cactus2Health - 25;
            }
        }

        function getPowerUp(powerUp, playerTank) {                                              // Powerup handling
            if(powerUp.data.get("Type") == 1) {
                this.shotDelay = 200;
                this.speedUp = true;
                this.speedUpEndTime = this.currentTime + 6000;
            }
            if(powerUp.data.get("Type") == 2) {
                this.multiShot = true;
                this.multiShotEndTime = this.currentTime + 8000
            }
            powerUp.destroy();
            playerScore += 150;
            scoreText.setText("Score: " + playerScore);
        }

        this.spawnClouds = function() {
            this.add.sprite(mapMiddleX, 125, "cloud3")
            .setScale(0.5)

            this.add.sprite(mapMiddleX - 1000, 275, "cloud1")
            .setScale(0.75)

            this.add.sprite(mapMiddleX + 750, 265, "cloud2")
            .setScale(0.6)
        }
        this.spawnClouds()
    }


    update() {

        this.currentTime = this.timer.getElapsedSeconds() * 1000;

        if(this.currentTime > this.nextEnemySpawn) {                                            //Spawn enemy tanks
            this.enemySpawnRate = Math.random() * 5000 + 1500
            this.nextEnemySpawn = this.nextEnemySpawn + this.enemySpawnRate;
            this.spawnTank();
        }



        if(this.enemyContainer.body) {                                                          //Move enemy tanks
            this.tanks.getChildren().forEach(enemy => {
                enemy.body.velocity.x = -gameOptions.enemySpeed * 0.5;
            })
        }

        if(!this.playerDead && !this.gameover) {
            this.playerGun.body.x = this.playerTank.body.x - 21;
            this.playerGun.body.y = this.playerTank.body.y - 20;
            
            this.mouseX = game.input.mousePointer.x;
            this.mouseY = game.input.mousePointer.y;

            let angle = Phaser.Math.Angle.Between(this.playerGun.x, this.playerGun.y, this.mouseX, this.mouseY)
            this.playerGun.rotation = angle + Math.PI;

            this.offset = new Phaser.Geom.Point(-50, -this.playerGun.height + 200);
            Phaser.Math.Rotate(this.offset, this.playerGun.rotation);
        }

        if(this.nextShotAt > this.currentTime) {                                                // Player firing cooldown timer
            this.firingCooldown = true;
        } else {
            this.firingCooldown = false;
        }


        if(!this.gameover) {                                                   
            if(this.cursors.left.isDown) {
                this.playerTank.body.velocity.x = -gameOptions.playerSpeed;                     //Player movement
                this.playerTank.flipX = false;
            }
            else if(this.cursors.right.isDown) {
                this.playerTank.body.velocity.x = gameOptions.playerSpeed;
                this.playerTank.flipX = true;
            }
            else {
                this.playerTank.body.velocity.x = 0;
            }

            if(this.cursors.up.isDown && this.playerTank.body.velocity.y == 0) {
                this.playerTank.body.velocity.y = -gameOptions.playerSpeed * 1.8;
            }

            if(this.input.mousePointer.isDown && !this.firingCooldown) {                        //Player firing
                this.bulletSpeed = 600;
    
                this.firingVector = new Phaser.Math.Vector2(this.mouseX - this.playerGun.x, this.mouseY - this.playerGun.y)
    
                this.boom.play()
                let bullet = this.add.circle(this.playerGun.x + this.offset.x, this.playerGun.y + this.offset.y, 5, "#000000");
                this.physics.add.existing(bullet);
                bullet.body.gravity.y = gameOptions.playerGravity * 0.5;
    
                this.firingVector.setLength(this.bulletSpeed)
                bullet.body.setVelocity(this.firingVector.x, this.firingVector.y)
    
                this.bullets.add(bullet)
                if(this.multiShot) {
                    bullet = this.add.circle(this.playerGun.x + this.offset.x, this.playerGun.y + this.offset.y, 5, "#000000");
                    this.physics.add.existing(bullet);
                    bullet.body.gravity.y = gameOptions.playerGravity * 0.5;
                    this.firingVector.rotate((Math.PI / 16))
                    bullet.body.setVelocity(this.firingVector.x, this.firingVector.y)
    
                    this.bullets.add(bullet)
    
                    bullet = this.add.circle(this.playerGun.x + this.offset.x, this.playerGun.y + this.offset.y, 5, "#000000");
                    this.physics.add.existing(bullet);
                    bullet.body.gravity.y = gameOptions.playerGravity * 0.5;
                    this.firingVector.rotate(-2 * Math.PI / 16)
                    bullet.body.setVelocity(this.firingVector.x, this.firingVector.y)
    
                    this.bullets.add(bullet)
                }
    
                this.nextShotAt = this.currentTime + this.shotDelay;
            }
        }
        

        
        this.tanks.getChildren().forEach(tank =>{                                               //Handle enemy tanks firing

        if(tank.data.get("NextShotAt") < this.currentTime) {
            tank.setData("Cooldown", Math.random() * 1000 * 8 + 1000)
            this.enemyNextShotAt = this.currentTime + tank.data.get("Cooldown");
            tank.setData("NextShotAt", this.enemyNextShotAt)

            let enemyBullet = this.add.circle(tank.body.x - 20, tank.body.y + 8, 5, "0x8B0000")
            this.enemyBoom.play()

            this.physics.add.existing(enemyBullet);
            enemyBullet.body.setVelocity(this.enemyFiringVector.x, this.enemyFiringVector.y)
            enemyBullet.body.gravity.y = gameOptions.playerGravity * 0.125;

            this.enemyBullets.add(enemyBullet)
            }
        })

        


        this.bullets.getChildren().forEach(bullet => {                                          // Destroy bullets out of bounds
            if(bullet.x > game.config.width + 100){
              bullet.destroy();
            }
        })

        this.enemyBullets.getChildren().forEach(bullet => {                                     // Destroy enemybullets out of bounds
            if(bullet.x > game.config.width + 300 | bullet.x < 0){
              bullet.destroy();
            }
        })

        if(this.speedUp && this.speedUpEndTime < this.currentTime) {                            // Shooting speed powerup timer
            this.shotDelay = 1000;
            this.hasSpeedUp = false;
        }

        if(this.multiShot && this.multiShotEndTime < this.currentTime) {                        // Shooting speed powerup timer
            this.multiShot = false;
        }
    }
}

class WinScreen extends Phaser.Scene {
    constructor() {
        super("WinScreen")
    }

    create() {
        const menuX = 925;
        const menuY = 400

        const graphics = this.add.graphics();
    
        graphics.fillStyle(0xff9933, 1);

        this.add.text(menuX - 650, menuY - 300, "The cat haters are destroyed, you did it!", {fill: "000"})
        .setFontSize(100);
        this.add.text(menuX - 150, menuY - 200, "You saved the orphanage!", {fill: "000"})
        .setFontSize(100);
    
        graphics.fillRect(menuX + 200, menuY, 720, 100)
    
        const LBButton = this.add.text(menuX + 200, menuY, "Leaderboards")
        .setFontSize(100)
        .setInteractive();
    
        LBButton.on("pointerdown", function() {
            self.scene.start("ScoreBoard")
        });

        graphics.fillRect(menuX, menuY + 150, 1150,100);

        const menuButton = this.add.text(menuX, menuY + 150, "Return to main menu")
        .setFontSize(100)
        .setInteractive();
    
        const self = this;
        menuButton.on("pointerdown", function() {
            self.scene.start("TitleScreen")
        });
    }

}

let game

const gameOptions = {
    playerGravity: 800,
    playerSpeed: 300,
    enemySpeed: 150
}

window.onload = function() {
    
    localStorage.setItem("justDied", false)

    localStorage.setItem("score1", 500);                //Scoreboard data setup
    localStorage.setItem("score2", 300);
    localStorage.setItem("score3", 100);
    
    localStorage.setItem("player1", "MIU");
    localStorage.setItem("player2", "MAU");
    localStorage.setItem("player3", "MOU");

    let gameConfig = { 
        type: Phaser.AUTO,
        backgroundColor: "#99ccff",
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: 3000,
            height: 1000,
        },
        pixelArt: true,
        physics: {
            default: "arcade",
            arcade: {
                debug: false,
                gravity: {
                    y: 0
                }
            }
        },
        scene: [
            TitleScreen, PlayGame, Level2, ScoreBoard, DeathSreen, WinScreen
        ]
    }
    game = new Phaser.Game(gameConfig);
    window.focus();
}
