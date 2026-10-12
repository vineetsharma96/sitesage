import test from 'node:test';
import assert from 'node:assert/strict';
import Matter from 'matter-js';
import { createAnchoredLetter } from '../src/lib/letter-physics.js';

test('a held letter remains still, then falls with finite coordinates when released', () => {
  const engine = Matter.Engine.create();
  const body = createAnchoredLetter(Matter, { x: 200, y: 100, width: 70, height: 90 });
  Matter.Composite.add(engine.world, body);
  for (let i = 0; i < 30; i++) Matter.Engine.update(engine, 1000 / 60);
  assert.equal(body.position.y, 100);
  Matter.Body.setStatic(body, false);
  assert.ok(Number.isFinite(body.mass) && Number.isFinite(body.inertia));
  for (let i = 0; i < 60; i++) Matter.Engine.update(engine, 1000 / 60);
  assert.ok(Number.isFinite(body.position.x) && Number.isFinite(body.position.y));
  assert.ok(body.position.y > 200, 'the letter must visibly fall, not only change its released flag');
  Matter.Engine.clear(engine);
});

test('restoring and releasing a letter again preserves usable physics', () => {
  const engine = Matter.Engine.create();
  const body = createAnchoredLetter(Matter, { x: 100, y: 70, width: 40, height: 60 });
  Matter.Composite.add(engine.world, body);
  for (let cycle = 0; cycle < 3; cycle++) {
    Matter.Body.setStatic(body, false);
    for (let i = 0; i < 30; i++) Matter.Engine.update(engine, 1000 / 60);
    assert.ok(Number.isFinite(body.position.y) && body.position.y > 100);
    Matter.Body.setStatic(body, true);
    Matter.Body.setPosition(body, { x: 100, y: 70 });
    Matter.Body.setVelocity(body, { x: 0, y: 0 });
  }
  Matter.Engine.clear(engine);
});
