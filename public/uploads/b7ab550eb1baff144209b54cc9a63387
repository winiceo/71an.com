var Balls = pc.createScript('balls');

Balls.attributes.add('count', { type: 'number', default: 25 });

// initialize code called once per entity
Balls.prototype.initialize = function() {
    this.balls = [];

    var ball = this.app.root.findByName('Ball');
    
    // Randomly generated a bunch of balls across the terrain
    for (var i = 0; i < this.count; i++) {
        var clone = ball.clone();
        this.app.root.addChild(clone);
        clone.rigidbody.teleport((Math.random() - 0.5) * 30, 5, (Math.random() - 0.5) * 30);
        this.balls.push(clone);
    }
};

// update code called every frame
Balls.prototype.update = function(dt) {
    for (var i = 0; i < this.balls.length; i++) {
        var ball = this.balls[i];
        var pos = ball.getPosition();
        if (pos.y < -10) {
            ball.rigidbody.linearVelocity = pc.Vec3.ZERO;
            ball.rigidbody.angularVelocity = pc.Vec3.ZERO;
            ball.rigidbody.teleport((Math.random() - 0.5) * 30, 5, (Math.random() - 0.5) * 30);
        }
    }
};

// swap method called for script hot-reloading
// inherit your script state here
// Balls.prototype.swap = function(old) { };

// to learn more about script anatomy, please read:
// http://developer.playcanvas.com/en/user-manual/scripting/